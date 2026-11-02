import { NextRequest } from 'next/server'
import { incomeSourceSchema } from '@proviso/core/schemas'
import { parseBody, withErrors, ApiError } from '@/lib/apiHandler'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { prisma } from '@/lib/db'

// Income other than pay: business profit (@proviso/core/businessIncome).

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const items = await prisma.incomeSource.findMany({ orderBy: { id: 'asc' } })
  return Response.json(items)
}

export const POST = withErrors(async (request: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, incomeSourceSchema)
  if (!body.person) throw new ApiError(400, 'Choose whose income it is.')
  const item = await prisma.incomeSource.create({
    data: {
      person: body.person, kind: body.kind ?? 'business', name: body.name ?? null, amount: body.amount ?? 0,
      growthPct: body.growthPct ?? 3, startYear: body.startYear ?? new Date().getFullYear(), endYear: body.endYear ?? null,
    },
  })
  return Response.json(item, { status: 201 })
})
