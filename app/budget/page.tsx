export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import BudgetClient from '@/components/budget/BudgetClient'

export default async function BudgetPage() {
  const me = await requireSession()
  const [expenses, income, person2Phases, assets, hs, childcare, annualExpenses, rentSettings] = await Promise.all([
    prisma.expense.findMany({ orderBy: { id: 'asc' } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.person2Phase.findMany({ orderBy: { year: 'asc' } }),
    prisma.asset.findMany(),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.childcareSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.annualExpense.findMany({ orderBy: { month: 'asc' } }),
    (prisma.rentSettings as any).findUnique({ where: { id: 1 } }),
  ])

  const currentYear = new Date().getFullYear()
  const currentPhase = person2Phases.find(p => p.year === currentYear)
  const currentDays = currentPhase?.days ?? 3

  const cashAsset = assets.find(a => a.name.toLowerCase().includes('cash'))
  const cashOnHand = cashAsset?.amt ?? 0

  return (
    <BudgetClient
      canEdit={me.role === 'CFO'}
      initialExpenses={expenses}
      initialIncome={income}
      initialChildcare={childcare}
      initialAnnualExpenses={annualExpenses}
      initialRentSettings={rentSettings ?? null}
      currentDays={currentDays}
      cashOnHand={cashOnHand}
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
    />
  )
}
