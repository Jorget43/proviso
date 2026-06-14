import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { authorize } from '@/lib/rbac'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url    = new URL(req.url)
  const userIdParam = url.searchParams.get('userId')
  const targetId = userIdParam ? parseInt(userIdParam) : session.userId

  if (session.role !== 'CFO' && targetId !== session.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const schedule = await prisma.allowanceSchedule.findUnique({ where: { userId: targetId } })
  return Response.json({ schedule })
}

export async function PUT(req: Request) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { userId, amount, dayOfWeek } = await req.json()
  if (!userId || amount == null) return Response.json({ error: 'userId and amount required' }, { status: 400 })

  const schedule = await prisma.allowanceSchedule.upsert({
    where:  { userId: Number(userId) },
    create: { userId: Number(userId), amount: Number(amount), dayOfWeek: Number(dayOfWeek ?? 5) },
    update: { amount: Number(amount), dayOfWeek: Number(dayOfWeek ?? 5) },
  })
  return Response.json({ schedule })
}
