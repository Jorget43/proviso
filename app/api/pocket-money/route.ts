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

  const txs = await prisma.pocketMoneyTx.findMany({
    where:   { userId: targetId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })
  return Response.json({ txs })
}

export async function POST(req: Request) {
  const gate = await authorize('child:write')
  if (!gate.ok) return gate.res

  const { userId, amount, description, date, category } = await req.json()
  if (amount == null || !description || !date) {
    return Response.json({ error: 'amount, description and date are required' }, { status: 400 })
  }

  const targetId = userId ? Number(userId) : gate.user.userId

  if (gate.user.role === 'CHILD') {
    if (targetId !== gate.user.userId) return Response.json({ error: 'Forbidden' }, { status: 403 })
    if (Number(amount) > 0) return Response.json({ error: 'Children can only record spends' }, { status: 403 })
  }

  const tx = await prisma.pocketMoneyTx.create({
    data: {
      userId:      targetId,
      amount:      Number(amount),
      description: String(description),
      date:        String(date),
      category:    String(category ?? 'general'),
    },
  })
  return Response.json({ tx })
}
