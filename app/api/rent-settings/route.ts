import { NextRequest } from 'next/server'
import { withErrors } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { authorize, requireAdultRead } from '@/lib/rbac'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const row = await (prisma.rentSettings as any).findUnique({ where: { id: 1 } })
  return Response.json(row ?? {})
}

export const PUT = withErrors(async (req: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await req.json()
  const row = await (prisma.rentSettings as any).upsert({
    where: { id: 1 },
    update: {
      enabled:               body.enabled               ?? false,
      monthlyRent:           Number(body.monthlyRent   ?? 0),
      annualIncreaseRate:    Number(body.annualIncreaseRate ?? 5.0),
      purchasePlanEnabled:   body.purchasePlanEnabled   ?? false,
      targetPurchaseYear:    Number(body.targetPurchaseYear ?? 2031),
      targetPropertyValue:   Number(body.targetPropertyValue ?? 800000),
      depositPct:            Number(body.depositPct    ?? 20.0),
      depositFromCash:       Number(body.depositFromCash ?? 0),
      depositFromInvestments: Number(body.depositFromInvestments ?? 0),
      newMortgageRate:       Number(body.newMortgageRate ?? 6.0),
      newMortgageTermYrs:    Number(body.newMortgageTermYrs ?? 30),
    },
    create: {
      id: 1,
      enabled:               body.enabled               ?? false,
      monthlyRent:           Number(body.monthlyRent   ?? 0),
      annualIncreaseRate:    Number(body.annualIncreaseRate ?? 5.0),
      purchasePlanEnabled:   body.purchasePlanEnabled   ?? false,
      targetPurchaseYear:    Number(body.targetPurchaseYear ?? 2031),
      targetPropertyValue:   Number(body.targetPropertyValue ?? 800000),
      depositPct:            Number(body.depositPct    ?? 20.0),
      depositFromCash:       Number(body.depositFromCash ?? 0),
      depositFromInvestments: Number(body.depositFromInvestments ?? 0),
      newMortgageRate:       Number(body.newMortgageRate ?? 6.0),
      newMortgageTermYrs:    Number(body.newMortgageTermYrs ?? 30),
    },
  })
  return Response.json(row)
})
