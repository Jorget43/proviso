import { NextRequest } from 'next/server'
import { withErrors, parseBody } from '@/lib/apiHandler'
import { childSchema } from '@proviso/core/schemas'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export const PUT = withErrors(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  const body = await parseBody(request, childSchema)
  const updated = await prisma.child.update({
    where: { id: parseInt(id) },
    data: { ...body, ...(body.name !== undefined ? { name: body.name?.trim() || null } : {}) },
  })
  return Response.json(updated)
})

export const DELETE = withErrors(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  await prisma.child.delete({ where: { id: parseInt(id) } })
  return new Response(null, { status: 204 })
})
