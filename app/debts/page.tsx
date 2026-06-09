export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import DebtsClient from '@/components/debts/DebtsClient'

function currentFyEnding(): number {
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  return month >= 7 ? year + 1 : year
}

export default async function DebtsPage() {
  const me = await requireSession()
  const fyEnding = currentFyEnding()
  const currentYear = new Date().getFullYear()

  const [debts, assets, mortgage, expenses, hs, helpDetails, income, projSettings, jorgePhases, gracePhases] = await Promise.all([
    prisma.debt.findMany({ orderBy: { id: 'asc' } }),
    prisma.asset.findMany({ orderBy: { id: 'asc' } }),
    prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.expense.findMany({ select: { amt: true, freq: true } }),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.helpDebtDetail.findMany({ where: { financialYearEnding: fyEnding } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.jorgePhase.findMany({ orderBy: { year: 'asc' } }),
    prisma.gracePhase.findMany({ orderBy: { year: 'asc' } }),
  ])

  const hasHelp = debts.some(d => /help|hecs/i.test(d.name)) || helpDetails.length > 0

  const person1Name = hs?.person1Name ?? 'Person 1'
  const person2Name = hs?.person2Name ?? 'Person 2'

  // Pro-rata current income by working days, matching the Budget panel and the
  // projection engine — HELP repayments are assessed on actual taxable income,
  // not the full-time-equivalent salary. Jorge defaults to full-time (5 days);
  // Grace defaults to 3 (mirrors app/budget/page.tsx).
  const jorgeDays = jorgePhases.find(p => p.year === currentYear)?.days ?? 5
  const graceDays = gracePhases.find(p => p.year === currentYear)?.days ?? 3
  const jorgeIncome = income.jorgeFTE * (jorgeDays / 5)
  const graceIncome = income.graceFTE * (graceDays / 5)

  // Pro-rata income per member — used to express the indexation saving as a
  // marginal-rate equivalent in the HELP alert.
  const helpIncome: Record<string, number> = {
    [person1Name]: jorgeIncome,
    [person2Name]: graceIncome,
  }

  const helpPersons = hasHelp ? [
    ...(income.jorgeHasHELP || debts.some(d => d.name.toLowerCase().includes(person1Name.toLowerCase()) && /help|hecs/i.test(d.name)) ? [{
      name:       person1Name,
      income:     jorgeIncome,
      growthRate: projSettings.jorgeGrowth,
      helpBalance: debts.find(d => d.name.toLowerCase().includes(person1Name.toLowerCase()) && /help|hecs/i.test(d.name))?.amt ?? 0,
    }] : []),
    ...(hs?.partnerEnabled && (income.graceHasHELP || debts.some(d => d.name.toLowerCase().includes(person2Name.toLowerCase()) && /help|hecs/i.test(d.name))) ? [{
      name:       person2Name,
      income:     graceIncome,
      growthRate: projSettings.graceGrowth,
      helpBalance: debts.find(d => d.name.toLowerCase().includes(person2Name.toLowerCase()) && /help|hecs/i.test(d.name))?.amt ?? 0,
    }] : []),
  ] : []

  return (
    <DebtsClient
      canEdit={me.role === 'CFO'}
      initialDebts={debts}
      initialAssets={assets}
      initialMortgage={mortgage}
      initialExpenses={expenses}
      householdSettings={hs ?? { person1Name: 'You', person2Name: 'Partner', partnerEnabled: false }}
      initialHelpDetails={helpDetails}
      helpIncome={helpIncome}
      fyEnding={fyEnding}
      showHelp={hasHelp}
      helpPersons={helpPersons}
    />
  )
}
