import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  await prisma.pocketMoneyTx.delete({ where: { id: parseInt(id) } })
  return Response.json({ ok: true })
}
