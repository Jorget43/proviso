import { NextRequest } from 'next/server'
import { lifePhaseSchema } from '@proviso/core/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

// A cost the household adds for a run of years ("Extra costs by year").
export const POST = withErrors(async (request: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, lifePhaseSchema)
  const year = new Date().getFullYear()
  const row = await prisma.lifePhase.create({
    data: {
      name: body.name ?? 'New cost', type: body.type ?? 'recurring', monthlyAmt: body.monthlyAmt ?? 0,
      startYear: body.startYear ?? year + 1, endYear: body.endYear ?? year + 5, cat: body.cat ?? 'Other',
      enabled: body.enabled ?? true, sortOrder: body.sortOrder ?? 0,
    },
  })
  return Response.json(row, { status: 201 })
})
