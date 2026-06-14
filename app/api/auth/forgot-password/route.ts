import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { sendResetEmail } from '@/lib/resetEmail'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function POST(req: Request) {
  const { username } = await req.json()
  if (!username) {
    return Response.json({ ok: true }) // no enumeration
  }

  const user = await prisma.user.findUnique({ where: { username: String(username).trim() } })

  // Always return success — never reveal whether the username exists or has an email.
  if (user?.email) {
    const token = randomBytes(32).toString('hex')
    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    })

    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`
    await sendResetEmail(user.email, resetUrl).catch(err =>
      console.error('[Proviso] Failed to send reset email:', err),
    )
  } else if (user && !user.email) {
    // User exists but has no email — log token so CFO can relay it manually.
    const token = randomBytes(32).toString('hex')
    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    })
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
    console.log(`[Proviso] Password reset for "${user.username}" (no email set). CFO relay URL: ${baseUrl}/reset-password?token=${token}`)
  }

  return Response.json({ ok: true })
}
