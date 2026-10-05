// Auth foundation (Phase 4.0) — self-hosted, zero external deps.
//
// Passwords: node:crypto scrypt (no native bcrypt — keeps the Alpine standalone
// image clean). Sessions: opaque random token stored server-side in the Session
// table, carried in an httpOnly cookie. The proxy does an optimistic cookie
// presence check; `requireSession()` here is the secure DB-backed check used at
// the page/route level.

import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { prisma } from './db'

const scryptAsync = promisify(scrypt)

export const SESSION_COOKIE = 'proviso_session'

// Session lifetime (Phase 21): a session ends after 7 days without use, and
// 30 days after sign-in no matter what. `Session.expiresAt` is the idle
// deadline; using the app pushes it forward (at most once a day, so reads
// don't write on every request), capped at createdAt + 30 days. The cookie
// itself lives the full 30 days — the DB row is what's checked.
const DAY_MS          = 24 * 60 * 60 * 1000
const SESSION_IDLE_MS = 7 * DAY_MS
const SESSION_MAX_MS  = 30 * DAY_MS
const RENEW_AFTER_MS  = DAY_MS

export function sessionExpiry(now: number, createdAt: Date): Date {
  return new Date(Math.min(now + SESSION_IDLE_MS, createdAt.getTime() + SESSION_MAX_MS))
}

// Extend once a day of use has passed since the last extension. Also clamps a
// deadline that's further out than the idle window (sessions created before
// the idle timeout existed carried a flat 30-day expiry).
export function needsRenewal(now: number, expiresAt: Date, createdAt: Date): boolean {
  const target = sessionExpiry(now, createdAt).getTime()
  const remaining = expiresAt.getTime() - now
  return expiresAt.getTime() !== target &&
    (remaining < SESSION_IDLE_MS - RENEW_AFTER_MS || remaining > SESSION_IDLE_MS)
}

export type Role = 'CFO' | 'PARTNER' | 'CHILD'

export interface SessionUser {
  userId:   number
  name:     string
  username: string
  role:     Role
}

// ── Password hashing ──────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':')
  if (!salt || !key) return false
  const keyBuf = Buffer.from(key, 'hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived)
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = sessionExpiry(now, new Date(now))
  await prisma.session.create({ data: { userId, token, expiresAt } })
  // Housekeeping: drop rows that have already expired (any user).
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Over plain http (e.g. http://nas:3000 on the tailnet) a Secure cookie
    // won't be stored. Default off; set COOKIE_SECURE=true behind HTTPS
    // (e.g. Tailscale Serve).
    secure:   process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    expires:  new Date(now + SESSION_MAX_MS),
    path:     '/',
  })
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
    cookieStore.delete(SESSION_COOKIE)
  }
}

// Ends a user's sessions — e.g. after their password is changed. With
// `keepCurrent`, the session making the request survives (changing your own
// password shouldn't sign you out of the device you did it on).
export async function revokeSessions(userId: number, { keepCurrent = false } = {}): Promise<void> {
  const current = keepCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : undefined
  await prisma.session.deleteMany({ where: { userId, ...(current ? { token: { not: current } } : {}) } })
}

// Secure check — validates the cookie token against the DB. Memoised per render.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } })
  if (!session) return null

  const now = Date.now()
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } })
    return null
  }
  if (needsRenewal(now, session.expiresAt, session.createdAt)) {
    // updateMany: a concurrent sign-out may already have removed the row.
    await prisma.session.updateMany({
      where: { id: session.id },
      data:  { expiresAt: sessionExpiry(now, session.createdAt) },
    })
  }

  return {
    userId:   session.user.id,
    name:     session.user.name,
    username: session.user.username,
    role:     session.user.role as Role,
  }
})

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

// Adult-only pages (household finances, settings). Authenticates first, then
// bounces CHILD users to their own pocket-money page so they never reach
// server-rendered household data. Mirrors the inverse redirect in
// app/child/page.tsx.
export async function requireAdult(): Promise<SessionUser> {
  const session = await requireSession()
  if (session.role === 'CHILD') redirect('/child')
  return session
}

// First-run gate: is any user set up yet?
export async function hasAnyUser(): Promise<boolean> {
  return (await prisma.user.count()) > 0
}
