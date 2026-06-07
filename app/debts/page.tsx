export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import DebtsClient from '@/components/debts/DebtsClient'

function currentFyEnding(): number {
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  return month >= 7 ? year + 1 : year
}

export default async function DebtsPage() {
  const fyEnding = currentFyEnding()

  const [debts, assets, mortgage, expenses, hs, helpDetails] = await Promise.all([
    prisma.debt.findMany({ orderBy: { id: 'asc' } }),
    prisma.asset.findMany({ orderBy: { id: 'asc' } }),
    prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.expense.findMany({ select: { amt: true, freq: true } }),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.helpDebtDetail.findMany({ where: { financialYearEnding: fyEnding } }),
  ])

  const hasHelp = debts.some(d => /help|hecs/i.test(d.name)) || helpDetails.length > 0

  return (
    <DebtsClient
      initialDebts={debts}
      initialAssets={assets}
      initialMortgage={mortgage}
      initialExpenses={expenses}
      householdSettings={hs ?? { person1Name: 'You', person2Name: 'Partner', partnerEnabled: false }}
      initialHelpDetails={helpDetails}
      fyEnding={fyEnding}
      showHelp={hasHelp}
    />
  )
}
