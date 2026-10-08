export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import { projectionBaseline } from '@proviso/core/future'
import { workDaysForYear } from '@proviso/core/projections'
import type { LifePhase } from '@proviso/core/lifephases'
import ProjectionsClient from '@/components/projections/ProjectionsClient'

export default async function ProjectionsPage() {
  const me = await requireAdult()
  const [income, settings, person1Phases, person2Phases, oneoffs, lifePhases, expenses, debts, assets, mortgage, hs, feeSchedule, rentSettings, snapshots, annualExpenses, childcare, sup] = await Promise.all([
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
    prisma.annualExpense.findMany(),
    prisma.childcareSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.superSettings.findFirst(),
  ])

  const person1Name = hs?.person1Name ?? 'Person 1'
  const person2Name = hs?.person2Name ?? 'Person 2'
  const currentYear = new Date().getFullYear()

  // Today's position, assembled the same way as the app's Future screen
  // (@proviso/core/future): the budget's spending (yearly bills and
  // childcare included) less rent and modelled school costs, and the
  // net-worth parts the engine starts from.
  const b = projectionBaseline({
    expenses, annualExpenses, income, childcare,
    rentMonthly: rentSettings?.enabled ? rentSettings.monthlyRent : null,
    person1Days: workDaysForYear(person1Phases, currentYear),
    person2Days: workDaysForYear(person2Phases, currentYear),
    partnerEnabled: hs?.partnerEnabled ?? false,
    person1Name, person2Name, debts, assets, mortgage,
  })

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
      baseline={b}
      mortRate={mortgage.rate}
      mortPayment={mortgage.payment}
      mortEndDate={mortgage.endDate}
      currentYear={currentYear}
      person1Name={person1Name}
      person2Name={person2Name}
      initialRentSettings={rentSettings ?? null}
      initialSnapshots={snapshots.map(s => ({ ...s, takenAt: s.takenAt.toISOString() }))}
      partnerEnabled={hs?.partnerEnabled ?? false}
      superSettings={{
        // The NAS's column names predate the shared shape (@proviso/core/future).
        sgRate: sup?.sgRate ?? 0.12, investmentReturn: sup?.investmentReturn ?? 0.06,
        fundFeePercent: sup?.fundFeePercent ?? 0.005, inflationRate: sup?.inflationRate ?? 0.04,
        desiredRetirementIncome: sup?.desiredRetirementIncome ?? 0,
        person1Balance: sup?.currentBalance ?? 0, person1RetirementAge: sup?.retirementAge ?? 67, person1AdditionalContribs: sup?.additionalContribs ?? 0,
        person2Balance: sup?.partnerBalance ?? 0, person2RetirementAge: sup?.partnerRetirementAge ?? 67, person2AdditionalContribs: sup?.partnerAdditionalContribs ?? 0,
      }}
    />
  )
}
