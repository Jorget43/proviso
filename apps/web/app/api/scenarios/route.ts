import { NextRequest } from 'next/server'
import { scenarioSchema } from '@proviso/core/schemas'
import { nextScenarioColour } from '@proviso/core/scenarios'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const scenarios = await prisma.scenario.findMany({ orderBy: { id: 'asc' } })
  return Response.json(scenarios)
}

export const POST = withErrors(async (request: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, scenarioSchema)
  const taken = (await prisma.scenario.findMany({ select: { colour: true } })).map(s => s.colour)
  const scenario = await prisma.scenario.create({
    data: {
      name: body.name ?? 'New scenario', colour: body.colour ?? nextScenarioColour(taken),
      enabled: body.enabled ?? true, overrides: body.overrides ?? '{}',
    },
  })
  return Response.json(scenario, { status: 201 })
})
