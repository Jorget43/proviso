import { prisma } from '@/lib/db'
import { pocketMoneySchema } from '@/lib/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
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

export const POST = withErrors(async (req: Request) => {
  const gate = await authorize('child:write')
  if (!gate.ok) return gate.res

  const { userId, amount, description, date, category } = await parseBody(req, pocketMoneySchema)

  const targetId = userId ?? gate.user.userId

  if (gate.user.role === 'CHILD') {
    if (targetId !== gate.user.userId) return Response.json({ error: 'Forbidden' }, { status: 403 })
    if (amount > 0) return Response.json({ error: 'Children can only record spends' }, { status: 403 })
  }

  const tx = await prisma.pocketMoneyTx.create({
    data: { userId: targetId, amount, description, date, category: category ?? 'general' },
  })
  return Response.json({ tx })
})
