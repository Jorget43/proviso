import { verify as totpVerify, generateSecret, generateURI } from 'otplib'
import QRCode from 'qrcode'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { getSession, hashPassword, verifyPassword } from '@/lib/auth'

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
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { secret, code } = await req.json()
  if (!secret || !code) return Response.json({ error: 'Secret and code required' }, { status: 400 })

  const result = await totpVerify({ token: String(code).replace(/\s/g, ''), secret: String(secret) })
  if (!result?.valid) return Response.json({ error: 'Invalid code — try again' }, { status: 400 })

  const plainCodes = Array.from({ length: 8 }, () => randomBytes(5).toString('hex'))
  const hashedCodes = await Promise.all(plainCodes.map(c => hashPassword(c)))

  await prisma.user.update({
    where: { id: session.userId },
    data:  { totpSecret: String(secret), totpRecoveryCodes: JSON.stringify(hashedCodes) },
  })

  return Response.json({ recoveryCodes: plainCodes })
}

// DELETE — disable TOTP (requires current password confirmation)
export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { password } = await req.json()
  if (!password) return Response.json({ error: 'Password required to disable 2FA' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  const ok = await verifyPassword(String(password), user.passwordHash)
  if (!ok) return Response.json({ error: 'Incorrect password' }, { status: 401 })

  await prisma.user.update({
    where: { id: session.userId },
    data:  { totpSecret: null, totpRecoveryCodes: null },
  })

  return Response.json({ ok: true })
}
