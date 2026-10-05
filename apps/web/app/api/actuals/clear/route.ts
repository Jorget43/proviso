import { prisma } from '@/lib/db'
import { withErrors } from '@/lib/apiHandler'
import { authorize } from '@/lib/rbac'

export const DELETE = withErrors(async () => {
  const gate = await authorize('actuals:write')
  if (!gate.ok) return gate.res
  await prisma.transaction.deleteMany()
  await prisma.suggestionState.deleteMany()
  return new Response(null, { status: 204 })
})
