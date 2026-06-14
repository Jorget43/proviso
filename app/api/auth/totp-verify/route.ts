import { verify as totpVerify } from 'otplib'
import { prisma } from '@/lib/db'
import { createSession, verifyPassword } from '@/lib/auth'
import { consumePendingTotp } from '@/lib/totpPending'

export async function POST(req: Request) {
  const { nonce, code, isRecovery } = await req.json()
  if (!nonce || !code) {
    return Response.json({ error: 'Nonce and code required' }, { status: 400 })
  }

  const userId = consumePendingTotp(String(nonce))
  if (!userId) {
    return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })
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
      return Response.json({ error: 'Invalid recovery code' }, { status: 401 })
    }
    codes.splice(matchIdx, 1)
    await prisma.user.update({ where: { id: userId }, data: { totpRecoveryCodes: JSON.stringify(codes) } })
  } else {
    const result = await totpVerify({ token: String(code).replace(/\s/g, ''), secret: user.totpSecret })
    if (!result?.valid) {
      return Response.json({ error: 'Invalid code' }, { status: 401 })
    }
  }

  await createSession(userId)
  return Response.json({ ok: true })
}
