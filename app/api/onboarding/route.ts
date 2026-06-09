import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'
import { computeMonthlyRepayment, monthsUntil } from '@/lib/mortgage'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const {
    person1Name, person1Age, person1Income,
    person1HasHELP, person1HELPBalance, person1Days,
    hasPartner,
    person2Name, person2Age, person2Income,
    person2HasHELP, person2HELPBalance, person2Days,
    person1Super, person2Super,
    sharesValue, cryptoValue, otherInvestments,
    cashBalance,
    hasMortgage, mortgageBalance, mortgageRate, mortgageEndDate,
    hasParentalLeave,
  } = await req.json()

  const currentYear = new Date().getFullYear()

  await prisma.$transaction(async tx => {
    await tx.householdSettings.upsert({
      where:  { id: 1 },
      update: { person1Name, person2Name, partnerEnabled: hasPartner, onboardingDone: true },
      create: { id: 1, person1Name, person2Name, partnerEnabled: hasPartner, onboardingDone: true },
    })

    await tx.projectionSettings.update({
      where: { id: 1 },
      data: { parentalLeaveEnabled: hasParentalLeave },
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

    // Assets from onboarding — upsert by name. Cash offsets the mortgage by
    // default when there's a loan (most households treat them as one balance).
    const cashIsOffset = hasMortgage && mortgageBalance > 0
    const assetUpserts: { name: string; amt: number; isOffset: boolean }[] = [
      { name: 'Cash / savings',   amt: cashBalance,      isOffset: cashIsOffset },
      { name: 'Shares & ETFs',    amt: sharesValue,      isOffset: false        },
      { name: 'Cryptocurrency',   amt: cryptoValue,      isOffset: false        },
      { name: 'Other investments',amt: otherInvestments, isOffset: false        },
    ]
    for (const { name, amt, isOffset } of assetUpserts) {
      const existing = await tx.asset.findFirst({ where: { name } })
      if (existing) {
        await tx.asset.update({ where: { id: existing.id }, data: { amt, isOffset } })
      } else if (amt > 0) {
        await tx.asset.create({ data: { name, amt, isOffset } })
      }
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
      // Repayment is derived from balance + rate + remaining term — no need to ask.
      const months  = monthsUntil(mortgageEndDate)
      const payment = computeMonthlyRepayment(mortgageBalance, mortgageRate, months)
      await tx.mortgageSettings.update({
        where: { id: 1 },
        data: {
          balance:   mortgageBalance,
          rate:      mortgageRate,
          payment,
          ...(mortgageEndDate ? { endDate: mortgageEndDate } : {}),
          // Cash offsets the loan by default (see assets upsert above).
          ...(cashIsOffset ? { offsetBal: cashBalance } : {}),
        },
      })
      // Keep the Budget 'Mortgage' line in sync so it isn't left at $0.
      await tx.expense.updateMany({
        where: { cat: 'Home', name: 'Mortgage' },
        data:  { amt: payment, freq: 'monthly' },
      })
    } else if (!hasMortgage) {
      await tx.mortgageSettings.update({
        where: { id: 1 },
        data: { balance: 0, payment: 0 },
      })
      await tx.expense.updateMany({
        where: { cat: 'Home', name: 'Mortgage' },
        data:  { amt: 0 },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
