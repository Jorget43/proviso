import { prisma } from '@/lib/db'
import { withErrors, parseBody } from '@/lib/apiHandler'
import { mortgageSettingsSchema } from '@/lib/schemas'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const settings = await prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } })
  return Response.json(settings)
}

export const PUT = withErrors(async (request: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, mortgageSettingsSchema)
  const updated = await prisma.mortgageSettings.update({ where: { id: 1 }, data: body })
  return Response.json(updated)
})
