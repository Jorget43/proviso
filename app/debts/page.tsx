import { prisma } from '@/lib/db'
import DebtsClient from '@/components/debts/DebtsClient'

export default async function DebtsPage() {
  const [debts, assets, mortgage, expenses] = await Promise.all([
    prisma.debt.findMany({ orderBy: { id: 'asc' } }),
    prisma.asset.findMany({ orderBy: { id: 'asc' } }),
    prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.expense.findMany({ select: { amt: true, freq: true } }),
  ])

  return (
    <DebtsClient
      initialDebts={debts}
      initialAssets={assets}
      initialMortgage={mortgage}
      initialExpenses={expenses}
    />
  )
}
