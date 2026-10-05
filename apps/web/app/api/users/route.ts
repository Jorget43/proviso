import { prisma } from '@/lib/db'
import { userCreateSchema } from '@proviso/core/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { authorize } from '@/lib/rbac'
import { hashPassword } from '@/lib/auth'

export async function GET() {
  const gate = await authorize('users:write')
  if (!gate.ok) return gate.res
  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, username: true, role: true, email: true, totpSecret: true,
      allowance: { select: { amount: true, dayOfWeek: true } },
    },
    orderBy: { id: 'asc' },
  })
  // Expose only whether 2FA is enrolled — never the TOTP secret itself.
  return Response.json(users.map(({ totpSecret, ...u }) => ({ ...u, hasTOTP: !!totpSecret })))
}

export const POST = withErrors(async (req: Request) => {
  const gate = await authorize('users:write')
  if (!gate.ok) return gate.res

  const { name, username, password, role } = await parseBody(req, userCreateSchema)

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return Response.json({ error: 'Username already taken' }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash: await hashPassword(password),
      role,
    },
    select: { id: true, name: true, username: true, role: true },
  })
  return Response.json(user, { status: 201 })
})
