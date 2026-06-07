import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const {
    person1Name, person1Age, person1Income,
    person1HasHELP, person1HELPBalance, person1Days,
    hasPartner,
    person2Name, person2Age, person2Income,
    person2HasHELP, person2HELPBalance, person2Days,
    person1Super, person2Super,
    cashBalance,
    hasMortgage, mortgageBalance, mortgageRate, mortgagePayment,
  } = await req.json()

  const currentYear = new Date().getFullYear()

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
        jorgeHasHELP: person1HasHELP,
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

    // Person 1 HELP debt
    const p1HelpDebt = await tx.debt.findFirst({ where: { name: `${person1Name} HELP debt` } })
    if (person1HasHELP && person1HELPBalance > 0) {
      if (p1HelpDebt) {
        await tx.debt.update({ where: { id: p1HelpDebt.id }, data: { amt: person1HELPBalance } })
      } else {
        await tx.debt.create({ data: { name: `${person1Name} HELP debt`, amt: person1HELPBalance } })
      }
    } else if (p1HelpDebt) {
      await tx.debt.delete({ where: { id: p1HelpDebt.id } })
    }

    // Person 2 HELP debt
    const p2HelpDebt = await tx.debt.findFirst({ where: { name: `${person2Name} HELP debt` } })
    if (hasPartner && person2HasHELP && person2HELPBalance > 0) {
      if (p2HelpDebt) {
        await tx.debt.update({ where: { id: p2HelpDebt.id }, data: { amt: person2HELPBalance } })
      } else {
        await tx.debt.create({ data: { name: `${person2Name} HELP debt`, amt: person2HELPBalance } })
      }
    } else if (p2HelpDebt) {
      await tx.debt.delete({ where: { id: p2HelpDebt.id } })
    }

    // Person 1 work schedule — seed initial JorgePhase
    const existingJorge = await tx.jorgePhase.findFirst({ where: { year: currentYear } })
    if (!existingJorge) {
      await tx.jorgePhase.create({ data: { year: currentYear, days: person1Days } })
    } else {
      await tx.jorgePhase.update({ where: { id: existingJorge.id }, data: { days: person1Days } })
    }

    // Person 2 work schedule — seed initial GracePhase
    if (hasPartner) {
      const existingGrace = await tx.gracePhase.findFirst({ where: { year: currentYear } })
      if (!existingGrace) {
        await tx.gracePhase.create({ data: { year: currentYear, days: person2Days } })
      } else {
        await tx.gracePhase.update({ where: { id: existingGrace.id }, data: { days: person2Days } })
      }
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
