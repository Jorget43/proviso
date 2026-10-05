export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import BudgetClient from '@/components/budget/BudgetClient'
import { workDaysForYear } from '@proviso/core/projections'
import { computeCashOnHand } from '@proviso/core/netWorth'

export default async function BudgetPage() {
  const me = await requireAdult()
  const [expenses, income, person1Phases, person2Phases, assets, hs, childcare, annualExpenses, rentSettings] = await Promise.all([
    prisma.expense.findMany({ orderBy: { id: 'asc' } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.person1Phase.findMany({ orderBy: { year: 'asc' } }),
    prisma.person2Phase.findMany({ orderBy: { year: 'asc' } }),
    prisma.asset.findMany(),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.childcareSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.annualExpense.findMany({ orderBy: { month: 'asc' } }),
    prisma.rentSettings.findUnique({ where: { id: 1 } }),
  ])

  const currentYear = new Date().getFullYear()

  return (
    <BudgetClient
      canEdit={me.role === 'CFO'}
      initialExpenses={expenses}
      initialIncome={income}
      initialChildcare={childcare}
      initialAnnualExpenses={annualExpenses}
      initialRentSettings={rentSettings ?? null}
      person1Days={workDaysForYear(person1Phases, currentYear)}
      person2Days={workDaysForYear(person2Phases, currentYear)}
      partnerEnabled={hs?.partnerEnabled ?? false}
      cashOnHand={computeCashOnHand(assets)}
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
    />
  )
}
