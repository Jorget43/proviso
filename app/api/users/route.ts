import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'
import { hashPassword } from '@/lib/auth'

const ROLES = ['CFO', 'PARTNER', 'CHILD']

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
  return Response.json(users)
}

export async function POST(req: Request) {
  const gate = await authorize('users:write')
  if (!gate.ok) return gate.res

  const { name, username, password, role } = await req.json()
  if (!name || !username || !password) {
    return Response.json({ error: 'Name, username and password required' }, { status: 400 })
  }
  if (!ROLES.includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (String(password).length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { username: String(username).trim() } })
  if (existing) {
    return Response.json({ error: 'Username already taken' }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: {
      name:         String(name).trim(),
      username:     String(username).trim(),
      passwordHash: await hashPassword(password),
      role,
    },
    select: { id: true, name: true, username: true, role: true },
  })
  return Response.json(user, { status: 201 })
}
