import { NextRequest } from 'next/server'
import { withErrors, parseBody } from '@/lib/apiHandler'
import { lifePhaseSchema } from '@/lib/schemas'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export const PUT = withErrors(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  const body = await parseBody(request, lifePhaseSchema)
  const updated = await prisma.lifePhase.update({ where: { id: parseInt(id) }, data: body })
  return Response.json(updated)
})
