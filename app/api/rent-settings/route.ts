import { NextRequest } from 'next/server'
import { rentSettingsSchema } from '@/lib/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { authorize, requireAdultRead } from '@/lib/rbac'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const row = await prisma.rentSettings.findUnique({ where: { id: 1 } })
  return Response.json(row ?? {})
}

export const PUT = withErrors(async (req: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  // Only the fields sent are changed; a first save fills the rest from the
  // schema defaults (an omitted field no longer resets to a hardcoded value).
  const data = await parseBody(req, rentSettingsSchema)
  const row = await prisma.rentSettings.upsert({
    where:  { id: 1 },
    update: data,
    create: { id: 1, ...data },
  })
  return Response.json(row)
})
