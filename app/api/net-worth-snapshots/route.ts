import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await prisma.netWorthSnapshot.findMany({ orderBy: { takenAt: 'asc' } })
  return Response.json(rows)
}

export async function POST(req: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { takenAt, netWorth } = await req.json()
  if (netWorth == null) {
    return Response.json({ error: 'netWorth is required' }, { status: 400 })
  }
  const row = await prisma.netWorthSnapshot.create({
    data: {
      netWorth: Number(netWorth),
      takenAt: takenAt ? new Date(takenAt) : new Date(),
      source: 'manual',
    },
  })
  return Response.json(row, { status: 201 })
}
