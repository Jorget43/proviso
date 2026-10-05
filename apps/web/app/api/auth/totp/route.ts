import { withErrors, parseBody } from '@/lib/apiHandler'
import { totpEnableSchema, totpDisableSchema } from '@proviso/core/schemas'
import { verify as totpVerify, generateSecret, generateURI } from 'otplib'
import QRCode from 'qrcode'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { getSession, hashPassword, verifyPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'

const APP_NAME = 'Proviso'

// GET  — generate an ephemeral TOTP secret + QR data URL (not saved until POST)
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const secret = generateSecret()
  const uri = generateURI({ label: session.username, issuer: APP_NAME, secret })
  const qr  = await QRCode.toDataURL(uri)

  return Response.json({ secret, qr })
}

// POST  — verify the code against the submitted secret and save to DB; return recovery codes
export const POST = withErrors(async (req: Request) => {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { secret, code } = await parseBody(req, totpEnableSchema, 'Enter the 6-digit code')

  const result = await totpVerify({ token: String(code).replace(/\s/g, ''), secret: String(secret) })
  if (!result?.valid) return Response.json({ error: 'Invalid code — try again' }, { status: 400 })

  const plainCodes = Array.from({ length: 8 }, () => randomBytes(5).toString('hex'))
  const hashedCodes = await Promise.all(plainCodes.map(c => hashPassword(c)))

  await prisma.user.update({
    where: { id: session.userId },
    data:  { totpSecret: String(secret), totpRecoveryCodes: JSON.stringify(hashedCodes) },
  })
  audit({ action: 'auth.2fa_on', userId: session.userId, username: session.username })

  return Response.json({ recoveryCodes: plainCodes })
})

// DELETE — disable TOTP (requires current password confirmation)
export const DELETE = withErrors(async (req: Request) => {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { password } = await parseBody(req, totpDisableSchema, 'Password required to disable 2FA')

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  const ok = await verifyPassword(String(password), user.passwordHash)
  if (!ok) {
    audit({ action: 'auth.2fa_off_failed', userId: session.userId, username: session.username, detail: 'wrong password' })
    return Response.json({ error: 'Incorrect password' }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data:  { totpSecret: null, totpRecoveryCodes: null },
  })
  audit({ action: 'auth.2fa_off', userId: session.userId, username: session.username })

  return Response.json({ ok: true })
})
