import { NextRequest } from 'next/server'
import { withErrors, parseBody } from '@/lib/apiHandler'
import { projectionSettingsSchema } from '@/lib/schemas'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const s = await prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } })
  return Response.json(s)
}

export const PUT = withErrors(async (request: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, projectionSettingsSchema)
  const updated = await prisma.projectionSettings.update({ where: { id: 1 }, data: body })
  return Response.json(updated)
})
