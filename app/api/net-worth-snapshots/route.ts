import { NextRequest } from 'next/server'
import { netWorthSnapshotSchema } from '@/lib/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { authorize, requireAdultRead } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const rows = await prisma.netWorthSnapshot.findMany({ orderBy: { takenAt: 'asc' } })
  return Response.json(rows)
}

export const POST = withErrors(async (req: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { takenAt, netWorth } = await parseBody(req, netWorthSnapshotSchema)
  const row = await prisma.netWorthSnapshot.create({
    data: {
      netWorth,
      takenAt: takenAt ? new Date(takenAt) : new Date(),
      source: 'manual',
    },
  })
  return Response.json(row, { status: 201 })
})
