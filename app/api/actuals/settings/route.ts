import { NextRequest } from 'next/server'
import { withErrors } from '@/lib/apiHandler'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const s = await prisma.actualsSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, useActualsProjections: false },
  })
  return Response.json(s)
}

export const PUT = withErrors(async (request: NextRequest) => {
  const gate = await authorize('actuals:write')
  if (!gate.ok) return gate.res
  const body = await request.json()
  const s = await prisma.actualsSettings.upsert({
    where:  { id: 1 },
    update: body,
    create: { id: 1, ...body },
  })
  return Response.json(s)
})
