import { NextRequest } from 'next/server'
import { withErrors, parseBody } from '@/lib/apiHandler'
import { phaseSchema } from '@/lib/schemas'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export const PUT = withErrors(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  const body = await parseBody(request, phaseSchema)
  const updated = await prisma.person2Phase.update({ where: { id: parseInt(id) }, data: body })
  return Response.json(updated)
})

export const DELETE = withErrors(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  await prisma.person2Phase.delete({ where: { id: parseInt(id) } })
  return new Response(null, { status: 204 })
})
