import { prisma } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'
import { isRateLimited } from '@/lib/loginRateLimit'

const LOCKOUT_THRESHOLD = 10
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  const { username, password } = await req.json()
  if (!username || !password) {
    return Response.json({ error: 'Username and password required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { username: String(username).trim() } })

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const retryAfterSecs = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
    return Response.json(
      { error: `Account locked. Try again in ${Math.ceil(retryAfterSecs / 60)} minute(s).` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } },
    )
  }

  // Verify even when the user is missing to avoid leaking which usernames exist.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false

  if (!user || !ok) {
    if (user) {
      const attempts = user.failedAttempts + 1
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: attempts,
          lockedUntil: attempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MS) : null,
        },
      })
    }
    return Response.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  // Success — reset lockout state before creating session.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  })

  // TOTP second factor — if enrolled, don't create a full session yet.
  if (user.totpSecret) {
    const { storePendingTotp } = await import('@/lib/totpPending')
    const nonce = storePendingTotp(user.id)
    return Response.json({ requiresTOTP: true, nonce })
  }

  await createSession(user.id)
  return Response.json({ ok: true })
}
