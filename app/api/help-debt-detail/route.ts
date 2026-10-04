import { prisma } from '@/lib/db'
import { helpDebtDetailSchema } from '@/lib/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { authorize } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export const PUT = withErrors(async (req: Request) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { member, financialYearEnding, openingFyBalance, estimatedWithheld, voluntaryRepayments, cpiRate } =
    await parseBody(req, helpDebtDetailSchema)

  const record = await prisma.helpDebtDetail.upsert({
    where:  { member_financialYearEnding: { member, financialYearEnding } },
    update: { openingFyBalance, estimatedWithheld, voluntaryRepayments, cpiRate },
    create: { member, financialYearEnding, openingFyBalance, estimatedWithheld, voluntaryRepayments, cpiRate },
  })

  return NextResponse.json(record)
})
