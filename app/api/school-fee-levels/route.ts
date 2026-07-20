import { prisma } from '@/lib/db'
import { requireAdultRead } from '@/lib/rbac'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const levels = await prisma.schoolFeeLevel.findMany({ orderBy: { id: 'asc' } })
  return Response.json(levels)
}
