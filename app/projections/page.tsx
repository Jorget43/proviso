export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import { toMonthly } from '@/lib/formatting'
import { computeCurrentNetWorth } from '@/lib/netWorth'
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
    (prisma.rentSettings as any).findUnique({ where: { id: 1 } }),
    prisma.netWorthSnapshot.findMany({ orderBy: { takenAt: 'asc' } }),
  ])

  const baseMonthlyExpenses = expenses.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)

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
      mortBalance={mortDebt}
      mortRate={mortgage.rate}
      mortPayment={mortgage.payment}
      mortEndDate={mortgage.endDate}
      cashOnHand={cashOnHand}
      propValue={propValue}
      cryptoValue={cryptoValue}
      currentYear={currentYear}
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
      initialRentSettings={rentSettings ?? null}
      initialSnapshots={snapshots.map(s => ({ ...s, takenAt: s.takenAt.toISOString() }))}
    />
  )
}
