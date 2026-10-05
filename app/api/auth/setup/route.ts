import { withErrors, parseBody } from '@/lib/apiHandler'
import { setupSchema } from '@/lib/schemas'
import { prisma } from '@/lib/db'
import { hashPassword, createSession, hasAnyUser } from '@/lib/auth'
import { audit } from '@/lib/audit'

// First-run only: creates the initial CFO. Refuses once any user exists.
export const POST = withErrors(async (req: Request) => {
  if (await hasAnyUser()) {
    return Response.json({ error: 'Setup already complete' }, { status: 403 })
  }

  const { name, username, password } = await parseBody(req, setupSchema)

  const user = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash: await hashPassword(password),
      role:         'CFO',
    },
  })

  await createSession(user.id)
  audit({ action: 'auth.setup', userId: user.id, username: user.username, detail: 'first CFO account created' })
  return Response.json({ ok: true })
})
