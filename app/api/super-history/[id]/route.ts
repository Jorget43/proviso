import { prisma } from '@/lib/db'
import { withErrors } from '@/lib/apiHandler'
import { authorize } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export const DELETE = withErrors(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  await prisma.superHistory.delete({ where: { id: parseInt(id) } })
  return new Response(null, { status: 204 })
})
