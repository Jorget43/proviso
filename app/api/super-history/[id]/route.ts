import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { id } = await params
  await prisma.superHistory.delete({ where: { id: parseInt(id) } })
  return new Response(null, { status: 204 })
}
