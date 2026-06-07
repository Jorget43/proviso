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

  const [debts, assets, mortgage, expenses, hs, helpDetails, income, projSettings] = await Promise.all([
    prisma.debt.findMany({ orderBy: { id: 'asc' } }),
    prisma.asset.findMany({ orderBy: { id: 'asc' } }),
    prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.expense.findMany({ select: { amt: true, freq: true } }),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.helpDebtDetail.findMany({ where: { financialYearEnding: fyEnding } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ])

  const hasHelp = debts.some(d => /help|hecs/i.test(d.name)) || helpDetails.length > 0

  const person1Name = hs?.person1Name ?? 'Person 1'
  const person2Name = hs?.person2Name ?? 'Person 2'

  const helpPersons = hasHelp ? [
    ...(income.jorgeHasHELP || debts.some(d => d.name.toLowerCase().includes(person1Name.toLowerCase()) && /help|hecs/i.test(d.name)) ? [{
      name:       person1Name,
      income:     income.jorgeFTE,
      growthRate: projSettings.jorgeGrowth,
      helpBalance: debts.find(d => d.name.toLowerCase().includes(person1Name.toLowerCase()) && /help|hecs/i.test(d.name))?.amt ?? 0,
    }] : []),
    ...(hs?.partnerEnabled && (income.graceHasHELP || debts.some(d => d.name.toLowerCase().includes(person2Name.toLowerCase()) && /help|hecs/i.test(d.name))) ? [{
      name:       person2Name,
      income:     income.graceFTE,
      growthRate: projSettings.graceGrowth,
      helpBalance: debts.find(d => d.name.toLowerCase().includes(person2Name.toLowerCase()) && /help|hecs/i.test(d.name))?.amt ?? 0,
    }] : []),
  ] : []

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
      helpPersons={helpPersons}
    />
  )
}
