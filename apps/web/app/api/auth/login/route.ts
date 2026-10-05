import { withErrors, parseBody } from '@/lib/apiHandler'
import { credentialsSchema } from '@proviso/core/schemas'
import { prisma } from '@/lib/db'
import { verifyPassword, signInResponse, sessionKindFor } from '@/lib/auth'
import { isRateLimited } from '@/lib/loginRateLimit'
import { audit } from '@/lib/audit'

const LOCKOUT_THRESHOLD = 10
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

export const POST = withErrors(async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  const { username, password } = await parseBody(req, credentialsSchema, 'Username and password required')

  const user = await prisma.user.findUnique({ where: { username } })

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const retryAfterSecs = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
    audit({ action: 'auth.signin_failed', userId: user.id, username: user.username, detail: 'account locked' })
    return Response.json(
      { error: `Account locked. Try again in ${Math.ceil(retryAfterSecs / 60)} minute(s).` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } },
    )
  }

  // Verify even when the user is missing to avoid leaking which usernames exist.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false

  if (!user || !ok) {
    // An unknown username isn't stored: it may be a mistyped password.
    audit(user
      ? { action: 'auth.signin_failed', userId: user.id, username: user.username, detail: 'wrong password' }
      : { action: 'auth.signin_failed', detail: 'unknown username' })
    if (user) {
      // A lockout that has already expired starts a fresh count — otherwise a
      // single typo after the wait would re-lock the account immediately.
      const priorAttempts = user.lockedUntil ? 0 : user.failedAttempts
      const attempts = priorAttempts + 1
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: attempts,
          lockedUntil: attempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MS) : null,
        },
      })
      if (attempts >= LOCKOUT_THRESHOLD) {
        audit({ action: 'auth.locked', userId: user.id, username: user.username, detail: `${attempts} failed attempts` })
      }
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

  audit({ action: 'auth.signin', userId: user.id, username: user.username, detail: `password${sessionKindFor(req) === 'app' ? ' (app)' : ''}` })
  return signInResponse(req, user.id)
})
