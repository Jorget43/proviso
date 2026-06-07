import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const {
    person1Name, person1Age, person1Income,
    hasPartner,
    person2Name, person2Age, person2Income, person2HasHELP, person2HELPBalance,
    person1Super, person2Super,
    cashBalance,
    hasMortgage, mortgageBalance, mortgageRate, mortgagePayment,
  } = await req.json()

  await prisma.$transaction(async tx => {
    await tx.householdSettings.upsert({
      where:  { id: 1 },
      update: { person1Name, person2Name, partnerEnabled: hasPartner, onboardingDone: true },
      create: { id: 1, person1Name, person2Name, partnerEnabled: hasPartner, onboardingDone: true },
    })

    await tx.incomeSettings.update({
      where: { id: 1 },
      data: {
        jorgeFTE:     person1Income,
        jorgeAge:     person1Age,
        graceFTE:     person2Income,
        graceAge:     person2Age,
        graceHasHELP: person2HasHELP,
      },
    })

    await tx.superSettings.update({
      where: { id: 1 },
      data: {
        currentBalance: person1Super,
        partnerBalance: person2Super,
        partnerEnabled: hasPartner,
      },
    })

    // Cash / savings asset
    const cashAsset = await tx.asset.findFirst({ where: { name: 'Cash / savings' } })
    if (cashAsset) {
      await tx.asset.update({ where: { id: cashAsset.id }, data: { amt: cashBalance } })
    } else {
      await tx.asset.create({ data: { name: 'Cash / savings', amt: cashBalance } })
    }

    // HELP / HECS debt
    const helpDebt = await tx.debt.findFirst({ where: { name: { contains: 'HELP' } } })
    if (hasPartner && person2HasHELP && person2HELPBalance > 0) {
      if (helpDebt) {
        await tx.debt.update({ where: { id: helpDebt.id }, data: { name: `${person2Name} HELP debt`, amt: person2HELPBalance } })
      } else {
        await tx.debt.create({ data: { name: `${person2Name} HELP debt`, amt: person2HELPBalance } })
      }
    } else if (helpDebt) {
      await tx.debt.delete({ where: { id: helpDebt.id } })
    }

    // Mortgage
    if (hasMortgage && mortgageBalance > 0) {
      await tx.mortgageSettings.update({
        where: { id: 1 },
        data: { balance: mortgageBalance, rate: mortgageRate, payment: mortgagePayment },
      })
    } else if (!hasMortgage) {
      await tx.mortgageSettings.update({
        where: { id: 1 },
        data: { balance: 0, payment: 0 },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
