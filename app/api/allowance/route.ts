import { prisma } from '@/lib/db'
import { allowanceSchema } from '@/lib/schemas'
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

  const schedule = await prisma.allowanceSchedule.findUnique({ where: { userId: targetId } })
  return Response.json({ schedule })
}

export const PUT = withErrors(async (req: Request) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { userId, amount, dayOfWeek } = await parseBody(req, allowanceSchema)

  const schedule = await prisma.allowanceSchedule.upsert({
    where:  { userId },
    create: { userId, amount, dayOfWeek },
    update: { amount, dayOfWeek },
  })
  return Response.json({ schedule })
})
