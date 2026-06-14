import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function PUT(req: Request) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { member, financialYearEnding, openingFyBalance, estimatedWithheld, voluntaryRepayments, cpiRate } = await req.json()

  const record = await prisma.helpDebtDetail.upsert({
    where:  { member_financialYearEnding: { member, financialYearEnding } },
    update: { openingFyBalance, estimatedWithheld, voluntaryRepayments, cpiRate },
    create: { member, financialYearEnding, openingFyBalance, estimatedWithheld, voluntaryRepayments, cpiRate },
  })

  return NextResponse.json(record)
}
