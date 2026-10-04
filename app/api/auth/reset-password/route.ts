import { withErrors, parseBody } from '@/lib/apiHandler'
import { resetPasswordSchema } from '@/lib/schemas'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export const POST = withErrors(async (req: Request) => {
  const { token, password } = await parseBody(req, resetPasswordSchema)

  const reset = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return Response.json({ error: 'Reset link is invalid or has expired' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await hashPassword(password), failedAttempts: 0, lockedUntil: null },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate all existing sessions so old devices are logged out.
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
  ])

  return Response.json({ ok: true })
})
