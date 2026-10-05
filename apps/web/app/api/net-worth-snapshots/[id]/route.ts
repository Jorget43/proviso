import { NextRequest } from 'next/server'
import { withErrors } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export const DELETE = withErrors(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  await prisma.netWorthSnapshot.delete({ where: { id: Number(id) } })
  return Response.json({ ok: true })
})
