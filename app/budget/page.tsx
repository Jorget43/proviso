export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import BudgetClient from '@/components/budget/BudgetClient'

export default async function BudgetPage() {
  const [expenses, income, gracePhases, assets] = await Promise.all([
    prisma.expense.findMany({ orderBy: { id: 'asc' } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.gracePhase.findMany({ orderBy: { year: 'asc' } }),
    prisma.asset.findMany(),
  ])

  const currentYear = new Date().getFullYear()
  const currentPhase = gracePhases.find(p => p.year === currentYear)
  const currentDays = currentPhase?.days ?? 3

  const cashAsset = assets.find(a => a.name.toLowerCase().includes('cash'))
  const cashOnHand = cashAsset?.amt ?? 0

  return (
    <BudgetClient
      initialExpenses={expenses}
      initialIncome={income}
      currentDays={currentDays}
      cashOnHand={cashOnHand}
    />
  )
}
