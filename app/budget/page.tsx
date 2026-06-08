export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import BudgetClient from '@/components/budget/BudgetClient'

export default async function BudgetPage() {
  const me = await requireSession()
  const [expenses, income, gracePhases, assets, hs] = await Promise.all([
    prisma.expense.findMany({ orderBy: { id: 'asc' } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.gracePhase.findMany({ orderBy: { year: 'asc' } }),
    prisma.asset.findMany(),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
  ])

  const currentYear = new Date().getFullYear()
  const currentPhase = gracePhases.find(p => p.year === currentYear)
  const currentDays = currentPhase?.days ?? 3

  const cashAsset = assets.find(a => a.name.toLowerCase().includes('cash'))
  const cashOnHand = cashAsset?.amt ?? 0

  return (
    <BudgetClient
      canEdit={me.role === 'CFO'}
      initialExpenses={expenses}
      initialIncome={income}
      currentDays={currentDays}
      cashOnHand={cashOnHand}
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
    />
  )
}
