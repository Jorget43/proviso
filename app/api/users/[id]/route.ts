import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'
import { hashPassword } from '@/lib/auth'

const ROLES = ['CFO', 'PARTNER', 'CHILD']

// Guard: never let the household lose its last CFO.
async function wouldRemoveLastCfo(targetId: number, newRole?: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target || target.role !== 'CFO') return false
  if (newRole === 'CFO') return false // still a CFO
  const cfoCount = await prisma.user.count({ where: { role: 'CFO' } })
  return cfoCount <= 1
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize('users:write')
  if (!gate.ok) return gate.res
  const id = parseInt((await params).id)

  const { role, password } = await req.json()
  const data: { role?: string; passwordHash?: string } = {}

  if (role !== undefined) {
    if (!ROLES.includes(role)) return Response.json({ error: 'Invalid role' }, { status: 400 })
    if (await wouldRemoveLastCfo(id, role)) {
      return Response.json({ error: 'Cannot demote the last CFO' }, { status: 400 })
    }
    data.role = role
  }
  if (password !== undefined) {
    if (String(password).length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    data.passwordHash = await hashPassword(password)
  }
  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where:  { id },
    data,
    select: { id: true, name: true, username: true, role: true },
  })
  return Response.json(user)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize('users:write')
  if (!gate.ok) return gate.res
  const id = parseInt((await params).id)

  if (id === gate.user.userId) {
    return Response.json({ error: 'You cannot remove your own account' }, { status: 400 })
  }
  if (await wouldRemoveLastCfo(id)) {
    return Response.json({ error: 'Cannot remove the last CFO' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id } }) // sessions cascade
  return new Response(null, { status: 204 })
}
