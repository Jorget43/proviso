export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import { toMonthly } from '@/lib/formatting'
import { computeCurrentNetWorth } from '@/lib/netWorth'
import { findHelpDebt } from '@/lib/members'
import type { LifePhase } from '@/lib/lifephases'
import ProjectionsClient from '@/components/projections/ProjectionsClient'

export default async function ProjectionsPage() {
  const me = await requireAdult()
  const [income, settings, person1Phases, person2Phases, oneoffs, lifePhases, expenses, debts, assets, mortgage, hs, feeSchedule, rentSettings, snapshots] = await Promise.all([
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.person1Phase.findMany({ orderBy: { year: 'asc' } }),
    prisma.person2Phase.findMany({ orderBy: { year: 'asc' } }),
    prisma.oneOff.findMany({ orderBy: { year: 'asc' } }),
    prisma.lifePhase.findMany({ orderBy: { sortOrder: 'asc' } }) as unknown as Promise<LifePhase[]>,
    prisma.expense.findMany(),
    prisma.debt.findMany(),
    prisma.asset.findMany(),
    prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.schoolFeeLevel.findMany({ orderBy: { id: 'asc' } }),
    prisma.rentSettings.findUnique({ where: { id: 1 } }),
    prisma.netWorthSnapshot.findMany({ orderBy: { takenAt: 'asc' } }),
  ])

  const baseMonthlyExpenses = expenses.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)
  // The Budget's mortgage repayment line(s). The engine models repayments
  // itself (un-inflated, stopping at payoff), so the client takes this back out
  // of the expense base while a mortgage is being modelled.
  const budgetMortgageMonthly = expenses
    .filter(e => e.cat === 'Home' && /mortgage/i.test(e.name))
    .reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)

  const person1Name = hs?.person1Name ?? 'Person 1'
  const person2Name = hs?.person2Name ?? 'Person 2'
  const person1HELPBalance = findHelpDebt(debts, person1Name)?.amt ?? 0
  const person2HELPBalance = hs?.partnerEnabled ? (findHelpDebt(debts, person2Name)?.amt ?? 0) : 0

  const { mortDebt, propValue, cryptoValue, cashOnHand } = computeCurrentNetWorth(debts, assets, mortgage)

  const currentYear = new Date().getFullYear()

  return (
    <ProjectionsClient
      canEdit={me.role === 'CFO'}
      initialSettings={settings}
      initialPerson1Phases={person1Phases}
      initialPerson2Phases={person2Phases}
      initialFeeSchedule={feeSchedule}
      initialOneoffs={oneoffs}
      initialLifePhases={lifePhases}
      income={income}
      baseMonthlyExpenses={baseMonthlyExpenses}
      budgetMortgageMonthly={budgetMortgageMonthly}
      person1HELPBalance={person1HELPBalance}
      person2HELPBalance={person2HELPBalance}
      mortBalance={mortDebt}
      mortRate={mortgage.rate}
      mortPayment={mortgage.payment}
      mortEndDate={mortgage.endDate}
      cashOnHand={cashOnHand}
      propValue={propValue}
      cryptoValue={cryptoValue}
      currentYear={currentYear}
      person1Name={person1Name}
      person2Name={person2Name}
      initialRentSettings={rentSettings ?? null}
      initialSnapshots={snapshots.map(s => ({ ...s, takenAt: s.takenAt.toISOString() }))}
    />
  )
}
