import { NextRequest } from 'next/server'
import { superSettingsSchema } from '@proviso/core/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { prisma } from '@/lib/db'

// Neutral fallbacks (mirror prisma/seed.ts) for a DB with no SuperSettings row.
const DB_DEFAULTS = {
  id: 1,
  currentBalance:            0,
  retirementAge:             67,
  additionalContribs:        0,
  sgRate:                    0.12,
  investmentReturn:          0.06,
  fundFeePercent:            0.005,
  inflationRate:             0.04,
  desiredRetirementIncome:   60000,
  partnerEnabled:            false,
  partnerBalance:            0,
  partnerRetirementAge:      67,
  partnerAdditionalContribs: 0,
  // Orphaned — kept for DB compat
  currentAge:                30,
  salaryExcSuper:            0,
  salaryGrowthRate:          0.04,
}

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const s = await prisma.superSettings.findFirst()
  return Response.json(s ?? DB_DEFAULTS)
}

export const PUT = withErrors(async (req: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  // Body uses HouseholdSuperInputs field names; map to DB column names
  const body = await parseBody(req, superSettingsSchema)
  // Only the fields sent are written (undefined is ignored by Prisma).
  const dbData = {
    currentBalance:            body.person1Balance,
    retirementAge:             body.person1RetirementAge,
    additionalContribs:        body.person1AdditionalContribs,
    sgRate:                    body.sgRate,
    investmentReturn:          body.investmentReturn,
    fundFeePercent:            body.fundFeePercent,
    inflationRate:             body.inflationRate,
    desiredRetirementIncome:   body.desiredRetirementIncome,
    partnerEnabled:            body.partnerEnabled,
    partnerBalance:            body.person2Balance,
    partnerRetirementAge:      body.person2RetirementAge,
    partnerAdditionalContribs: body.person2AdditionalContribs,
  }
  const s = await prisma.superSettings.upsert({
    where:  { id: 1 },
    update: dbData,
    create: { ...DB_DEFAULTS, ...dbData, id: 1 },
  })
  return Response.json(s)
})
