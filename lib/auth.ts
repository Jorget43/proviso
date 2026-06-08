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
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

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
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await prisma.session.create({ data: { userId, token, expiresAt } })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Over plain http (e.g. http://nas:3000 on the tailnet) a Secure cookie
    // won't be stored. Default off; set COOKIE_SECURE=true behind HTTPS
    // (e.g. Tailscale Serve).
    secure:   process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    expires:  expiresAt,
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

// Secure check — validates the cookie token against the DB. Memoised per render.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } })
  if (!session || session.expiresAt < new Date()) return null

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

// First-run gate: is any user set up yet?
export async function hasAnyUser(): Promise<boolean> {
  return (await prisma.user.count()) > 0
}
