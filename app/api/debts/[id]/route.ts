import { prisma } from '@/lib/db'
import { withErrors, parseBody } from '@/lib/apiHandler'
import { debtSchema } from '@/lib/schemas'
import { authorize } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export const PUT = withErrors(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  const body = await parseBody(request, debtSchema)
  const updated = await prisma.debt.update({ where: { id: parseInt(id) }, data: body })
  return Response.json(updated)
})

export const DELETE = withErrors(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  await prisma.debt.delete({ where: { id: parseInt(id) } })
  return new Response(null, { status: 204 })
})
