import { prisma } from '@/lib/db'
import { withErrors, parseBody, ApiError } from '@/lib/apiHandler'
import { authorize } from '@/lib/rbac'
import { householdNamesSchema } from '@proviso/core/schemas'
import { renameMembers, validateMemberNames } from '@proviso/core/members'

// Rename the household's people. Cascades to every row keyed by display name
// (super history, HELP details, investment parcels, "<name> HELP debt").
export const PUT = withErrors(async (req: Request) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const body = await parseBody(req, householdNamesSchema)
  const current = await prisma.householdSettings.findUnique({ where: { id: 1 } })
  if (!current) throw new ApiError(404, 'Household not set up yet')

  // Where the household lives (schema v6): no renaming involved.
  const where = { ...(body.state !== undefined ? { state: body.state } : {}), ...(body.regional !== undefined ? { regional: body.regional } : {}) }
  if (body.person1Name === undefined && body.person2Name === undefined) {
    return Response.json(await prisma.householdSettings.update({ where: { id: 1 }, data: where }))
  }

  const person1Name = (body.person1Name ?? current.person1Name).trim()
  const person2Name = (body.person2Name ?? current.person2Name).trim()
  const invalid = validateMemberNames(person1Name, person2Name, current.partnerEnabled)
  if (invalid) throw new ApiError(400, invalid)

  const updated = await prisma.$transaction(async tx => {
    await renameMembers(tx, [
      { from: current.person1Name, to: person1Name },
      { from: current.person2Name, to: person2Name },
    ])
    return tx.householdSettings.update({ where: { id: 1 }, data: { person1Name, person2Name, ...where } })
  })
  return Response.json(updated)
})
