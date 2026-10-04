export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import DebtsClient from '@/components/debts/DebtsClient'
import { workDaysForYear } from '@/lib/projections'
import { findHelpDebt } from '@/lib/members'

function currentFyEnding(): number {
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  return month >= 7 ? year + 1 : year
}

export default async function DebtsPage() {
  const me = await requireAdult()
  const fyEnding = currentFyEnding()
  const currentYear = new Date().getFullYear()

  const [debts, assets, mortgage, expenses, hs, helpDetails, income, projSettings, person1Phases, person2Phases] = await Promise.all([
    prisma.debt.findMany({ orderBy: { id: 'asc' } }),
    prisma.asset.findMany({ orderBy: { id: 'asc' } }),
    prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.expense.findMany({ select: { amt: true, freq: true } }),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.helpDebtDetail.findMany({ where: { financialYearEnding: fyEnding } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.person1Phase.findMany({ orderBy: { year: 'asc' } }),
    prisma.person2Phase.findMany({ orderBy: { year: 'asc' } }),
  ])

  const hasHelp = debts.some(d => /help|hecs/i.test(d.name)) || helpDetails.length > 0

  const person1Name = hs?.person1Name ?? 'Person 1'
  const person2Name = hs?.person2Name ?? 'Person 2'

  // Pro-rata current income by working days, matching the Budget panel and the
  // projection engine — HELP repayments are assessed on actual taxable income,
  // not the full-time-equivalent salary. Same phase rule as the projection
  // engine (latest phase on or before this year; full-time when none).
  const person1Days = workDaysForYear(person1Phases, currentYear)
  const person2Days = workDaysForYear(person2Phases, currentYear)
  const person1Income = income.person1FTE * (person1Days / 5)
  const person2Income = income.person2FTE * (person2Days / 5)

  // Pro-rata income per member — used to express the indexation saving as a
  // marginal-rate equivalent in the HELP alert.
  const helpIncome: Record<string, number> = {
    [person1Name]: person1Income,
    [person2Name]: person2Income,
  }

  // Each person's HELP debt is matched by name as a whole word (see
  // lib/members.ts), never by substring.
  const person1HelpDebt = findHelpDebt(debts, person1Name)
  const person2HelpDebt = hs?.partnerEnabled ? findHelpDebt(debts, person2Name) : undefined

  const helpPersons = hasHelp ? [
    ...(income.person1HasHELP || person1HelpDebt ? [{
      name:        person1Name,
      income:      person1Income,
      growthRate:  projSettings.person1Growth,
      helpBalance: person1HelpDebt?.amt ?? 0,
    }] : []),
    ...(hs?.partnerEnabled && (income.person2HasHELP || person2HelpDebt) ? [{
      name:        person2Name,
      income:      person2Income,
      growthRate:  projSettings.person2Growth,
      helpBalance: person2HelpDebt?.amt ?? 0,
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
