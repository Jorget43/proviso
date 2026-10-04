import { NextRequest } from 'next/server'
import { withErrors } from '@/lib/apiHandler'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export const PUT = withErrors(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  const { tuition, fixed } = await request.json()
  const updated = await prisma.schoolFeeLevel.update({
    where: { id: parseInt(id) },
    data: { tuition, fixed },
  })
  return Response.json(updated)
})
