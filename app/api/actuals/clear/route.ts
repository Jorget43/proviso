import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export async function DELETE() {
  const gate = await authorize('actuals:write')
  if (!gate.ok) return gate.res
  await prisma.transaction.deleteMany()
  await prisma.suggestionState.deleteMany()
  return new Response(null, { status: 204 })
}
