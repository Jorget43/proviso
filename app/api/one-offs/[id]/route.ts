import { NextRequest } from 'next/server'
import { withErrors, parseBody } from '@/lib/apiHandler'
import { oneOffSchema } from '@/lib/schemas'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export const PUT = withErrors(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  const body = await parseBody(request, oneOffSchema)
  const updated = await prisma.oneOff.update({ where: { id: parseInt(id) }, data: body })
  return Response.json(updated)
})

export const DELETE = withErrors(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  await prisma.oneOff.delete({ where: { id: parseInt(id) } })
  return new Response(null, { status: 204 })
})
