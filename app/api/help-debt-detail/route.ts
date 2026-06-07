import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request) {
  const { member, financialYearEnding, openingFyBalance, estimatedWithheld, voluntaryRepayments, cpiRate } = await req.json()

  const record = await prisma.helpDebtDetail.upsert({
    where:  { member_financialYearEnding: { member, financialYearEnding } },
    update: { openingFyBalance, estimatedWithheld, voluntaryRepayments, cpiRate },
    create: { member, financialYearEnding, openingFyBalance, estimatedWithheld, voluntaryRepayments, cpiRate },
  })

  return NextResponse.json(record)
}
