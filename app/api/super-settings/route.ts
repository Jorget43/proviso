import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

const DB_DEFAULTS = {
  id: 1,
  currentBalance:            164000,
  retirementAge:             67,
  additionalContribs:        0,
  sgRate:                    0.12,
  investmentReturn:          0.06,
  fundFeePercent:            0.005,
  inflationRate:             0.04,
  desiredRetirementIncome:   80000,
  partnerEnabled:            true,
  partnerBalance:            80000,
  partnerRetirementAge:      67,
  partnerAdditionalContribs: 0,
  // Orphaned — kept for DB compat
  currentAge:                34,
  salaryExcSuper:            135035,
  salaryGrowthRate:          0.04,
}

export async function GET() {
  const s = await prisma.superSettings.findFirst()
  return Response.json(s ?? DB_DEFAULTS)
}

export async function PUT(req: NextRequest) {
  // Body uses HouseholdSuperInputs field names; map to DB column names
  const body = await req.json()
  const dbData = {
    currentBalance:            body.jorgeBalance,
    retirementAge:             body.jorgeRetirementAge,
    additionalContribs:        body.jorgeAdditionalContribs,
    sgRate:                    body.sgRate,
    investmentReturn:          body.investmentReturn,
    fundFeePercent:            body.fundFeePercent,
    inflationRate:             body.inflationRate,
    desiredRetirementIncome:   body.desiredRetirementIncome,
    partnerEnabled:            body.partnerEnabled,
    partnerBalance:            body.graceBalance,
    partnerRetirementAge:      body.graceRetirementAge,
    partnerAdditionalContribs: body.graceAdditionalContribs,
  }
  const s = await prisma.superSettings.upsert({
    where:  { id: 1 },
    update: dbData,
    create: { ...DB_DEFAULTS, ...dbData, id: 1 },
  })
  return Response.json(s)
}
