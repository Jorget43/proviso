// Auth foundation (Phase 4.0) — self-hosted, zero external deps.
//
// Passwords: node:crypto scrypt (no native bcrypt — keeps the Alpine standalone
// image clean). Sessions: opaque random token, carried in an httpOnly cookie
// (browser) or an `Authorization: Bearer` header (native app). The Session
// table stores only its SHA-256, so a copy of the database can't sign anyone
// in. The proxy does an optimistic cookie presence check; `requireSession()`
// here is the secure DB-backed check used at the page/route level.

import { scrypt, randomBytes, timingSafeEqual, createHash } from 'crypto'
import { isThemeChoice, type ThemeChoice } from './theme'
import { promisify } from 'util'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { prisma } from './db'
import { pruneAuditLog } from './audit'

const scryptAsync = promisify(scrypt)

export const SESSION_COOKIE = 'proviso_session'

// Session lifetime (Phase 21): a browser session ends after 7 days without
// use, and 30 days after sign-in no matter what. The native app (Phase 24)
// gets 30 days idle / 90 days absolute — retyping a password on a phone
// every week pushes people towards weak ones. `Session.expiresAt` is the idle
// deadline; using the app pushes it forward (at most once a day, so reads
// don't write on every request), capped at createdAt + the absolute limit.
// The cookie itself lives the full 30 days — the DB row is what's checked.
const DAY_MS         = 24 * 60 * 60 * 1000
const RENEW_AFTER_MS = DAY_MS

export type SessionKind = 'web' | 'app'

const LIFETIME: Record<SessionKind, { idle: number; max: number }> = {
  web: { idle: 7 * DAY_MS,  max: 30 * DAY_MS },
  app: { idle: 30 * DAY_MS, max: 90 * DAY_MS },
}

export function sessionExpiry(now: number, createdAt: Date, kind: SessionKind = 'web'): Date {
  const { idle, max } = LIFETIME[kind]
  return new Date(Math.min(now + idle, createdAt.getTime() + max))
}

// Extend once a day of use has passed since the last extension. Also clamps a
// deadline that's further out than the idle window (sessions created before
// the idle timeout existed carried a flat 30-day expiry).
export function needsRenewal(now: number, expiresAt: Date, createdAt: Date, kind: SessionKind = 'web'): boolean {
  const { idle } = LIFETIME[kind]
  const target = sessionExpiry(now, createdAt, kind).getTime()
  const remaining = expiresAt.getTime() - now
  return expiresAt.getTime() !== target &&
    (remaining < idle - RENEW_AFTER_MS || remaining > idle)
}

/** What's stored in Session.token: the secret is never kept, only its hash. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// The native app sends this header on sign-in and gets the token back in the
// response body instead of a cookie.
export function sessionKindFor(req: Request): SessionKind {
  return req.headers.get('x-proviso-client') === 'app' ? 'app' : 'web'
}

export type Role = 'CFO' | 'PARTNER' | 'CHILD'

export interface SessionUser {
  userId:   number
  name:     string
  username: string
  role:     Role
  /** Appearance: follow the device, or always light / dark. */
  theme:    ThemeChoice
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

// Signs a user in. For the browser the token goes into the cookie; for the
// app the caller returns it in the response body. Either way only its hash
// is stored.
export async function createSession(
  userId: number,
  opts: { kind?: SessionKind; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const kind = opts.kind ?? 'web'
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = sessionExpiry(now, new Date(now), kind)
  const userAgent = opts.userAgent ? opts.userAgent.slice(0, 300) : null
  await prisma.session.create({ data: { userId, token: hashToken(token), kind, userAgent, expiresAt } })
  // Housekeeping: drop rows that have already expired (any user), and audit
  // entries past retention.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } })
  await pruneAuditLog()

  if (kind === 'web') {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      // Over plain http (e.g. http://nas:3000 on the tailnet) a Secure cookie
      // won't be stored. Default off; set COOKIE_SECURE=true behind HTTPS
      // (e.g. Tailscale Serve).
      secure:   process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      expires:  new Date(now + LIFETIME.web.max),
      path:     '/',
    })
  }
  return { token, expiresAt }
}

// Signs in through one of the sign-in routes and builds the success response:
// the browser gets a cookie, the app gets its token in the body.
export async function signInResponse(req: Request, userId: number): Promise<Response> {
  const kind = sessionKindFor(req)
  const { token, expiresAt } = await createSession(userId, { kind, userAgent: req.headers.get('user-agent') })
  return Response.json(kind === 'app' ? { ok: true, token, expiresAt: expiresAt.toISOString() } : { ok: true })
}

// The token this request presents, and how: a bearer header (the app) wins
// over the cookie. Each kind of session is only accepted the way it was
// issued, so an app token can't be used as a cookie or the other way round.
async function presentedToken(): Promise<{ token: string; kind: SessionKind } | null> {
  const auth = (await headers()).get('authorization')
  const bearer = auth?.match(/^Bearer\s+([0-9a-f]{64})$/i)?.[1]
  if (bearer) return { token: bearer.toLowerCase(), kind: 'app' }
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value
  return cookie ? { token: cookie, kind: 'web' } : null
}

/** Hash of the current request's session token, if it presents one. */
export async function currentTokenHash(): Promise<string | null> {
  const presented = await presentedToken()
  return presented ? hashToken(presented.token) : null
}

export async function destroySession(): Promise<void> {
  const presented = await presentedToken()
  if (!presented) return
  await prisma.session.deleteMany({ where: { token: hashToken(presented.token) } })
  if (presented.kind === 'web') (await cookies()).delete(SESSION_COOKIE)
}

// Ends a user's sessions — e.g. after their password is changed. With
// `keepCurrent`, the session making the request survives (changing your own
// password shouldn't sign you out of the device you did it on).
export async function revokeSessions(userId: number, { keepCurrent = false } = {}): Promise<number> {
  const current = keepCurrent ? await currentTokenHash() : null
  const { count } = await prisma.session.deleteMany({ where: { userId, ...(current ? { token: { not: current } } : {}) } })
  return count
}

// Secure check — validates the cookie or bearer token against the DB.
// Memoised per render.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const presented = await presentedToken()
  if (!presented) return null

  const session = await prisma.session.findUnique({ where: { token: hashToken(presented.token) }, include: { user: true } })
  if (!session || session.kind !== presented.kind) return null
  const kind = session.kind as SessionKind

  const now = Date.now()
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } })
    return null
  }
  if (needsRenewal(now, session.expiresAt, session.createdAt, kind)) {
    // updateMany: a concurrent sign-out may already have removed the row.
    // lastUsedAt moves with it, so "last active" is accurate to about a day.
    await prisma.session.updateMany({
      where: { id: session.id },
      data:  { expiresAt: sessionExpiry(now, session.createdAt, kind), lastUsedAt: new Date(now) },
    })
  }

  return {
    userId:   session.user.id,
    name:     session.user.name,
    username: session.user.username,
    role:     session.user.role as Role,
    theme:    isThemeChoice(session.user.themePreference) ? session.user.themePreference : 'system',
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
