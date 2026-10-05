import { withErrors, parseBody } from '@/lib/apiHandler'
import { totpVerifySchema } from '@proviso/core/schemas'
import { verify as totpVerify } from 'otplib'
import { prisma } from '@/lib/db'
import { signInResponse, sessionKindFor, verifyPassword } from '@/lib/auth'
import { getPendingTotp, recordFailedTotp, consumePendingTotp } from '@/lib/totpPending'
import { audit } from '@/lib/audit'

export const POST = withErrors(async (req: Request) => {
  const { nonce, code, isRecovery } = await parseBody(req, totpVerifySchema, 'Enter the code')

  const userId = getPendingTotp(String(nonce))
  if (!userId) {
    return Response.json({ error: 'Session expired. Please sign in again.', restart: true }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.totpSecret) {
    return Response.json({ error: 'TOTP not configured for this account' }, { status: 400 })
  }

  if (isRecovery) {
    const codes: string[] = JSON.parse(user.totpRecoveryCodes ?? '[]')
    let matchIdx = -1
    for (let i = 0; i < codes.length; i++) {
      if (await verifyPassword(String(code).trim(), codes[i])) { matchIdx = i; break }
    }
    if (matchIdx === -1) {
      audit({ action: 'auth.signin_failed', userId, username: user.username, detail: 'wrong recovery code' })
      return failed(String(nonce), 'Invalid recovery code')
    }
    codes.splice(matchIdx, 1)
    await prisma.user.update({ where: { id: userId }, data: { totpRecoveryCodes: JSON.stringify(codes) } })
  } else {
    const result = await totpVerify({ token: String(code).replace(/\s/g, ''), secret: user.totpSecret })
    if (!result?.valid) {
      audit({ action: 'auth.signin_failed', userId, username: user.username, detail: 'wrong authenticator code' })
      return failed(String(nonce), 'Invalid code')
    }
  }

  consumePendingTotp(String(nonce))
  const how = isRecovery ? 'password + recovery code' : 'password + authenticator code'
  audit({ action: 'auth.signin', userId, username: user.username, detail: `${how}${sessionKindFor(req) === 'app' ? ' (app)' : ''}` })
  return signInResponse(req, userId)
})

function failed(nonce: string, message: string): Response {
  const canRetry = recordFailedTotp(nonce)
  return Response.json(
    canRetry ? { error: message } : { error: 'Too many attempts. Please sign in again.', restart: true },
    { status: 401 },
  )
}
