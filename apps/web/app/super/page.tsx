export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import { computeBudgetSummary } from '@proviso/core/budgetSummary'
import { retirementIncomeGoal, spendingInRetirement } from '@proviso/core/future'
import { workDaysForYear } from '@proviso/core/projections'
import SuperClient from '@/components/super/SuperClient'
import type { HouseholdSuperInputs, ProjectionContext } from '@proviso/core/super'

export default async function SuperPage() {
  const me = await requireAdult()
  const [s, inc, proj, mtg, expenses, hs, superHistory, rent, annualExpenses, childcare, person1Phases, person2Phases] = await Promise.all([
    prisma.superSettings.findFirst(),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.mortgageSettings.findFirst(),
    prisma.expense.findMany(),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.superHistory.findMany({ orderBy: { financialYearEnding: 'desc' } }),
    prisma.rentSettings.findFirst(),
    prisma.annualExpense.findMany(),
    prisma.childcareSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.person1Phase.findMany(),
    prisma.person2Phase.findMany(),
  ])

  // Today's budget spending (yearly bills, childcare and rent included), the
  // same figure as the Budget tab. Less the home loan and the children's
  // costs, it stands in for the retirement income goal until one is saved
  // (@proviso/core/future, shared with the app).
  const year = new Date().getFullYear()
  const budget = computeBudgetSummary({
    expenses, annualExpenses, income: inc, childcare,
    rentMonthly: rent?.enabled ? rent.monthlyRent : null,
    person1Days: workDaysForYear(person1Phases, year), person2Days: workDaysForYear(person2Phases, year),
    partnerEnabled: hs?.partnerEnabled ?? false,
  })
  const budgetAnnualSpend = Math.round(budget.monthlyExpenses * 12 / 1000) * 1000
  const retirementIncome = retirementIncomeGoal(s?.desiredRetirementIncome ?? 0, spendingInRetirement(budget, expenses))

  const initial: HouseholdSuperInputs = {
    sgRate:                   s?.sgRate                    ?? 0.12,
    investmentReturn:         s?.investmentReturn          ?? 0.06,
    fundFeePercent:           s?.fundFeePercent            ?? 0.005,
    inflationRate:            s?.inflationRate             ?? 0.04,
    desiredRetirementIncome:  retirementIncome,
    person1Balance:           s?.currentBalance            ?? 0,
    person1RetirementAge:     s?.retirementAge             ?? 67,
    person1AdditionalContribs:s?.additionalContribs        ?? 0,
    partnerEnabled:           s?.partnerEnabled            ?? hs?.partnerEnabled ?? false,
    person2Balance:           s?.partnerBalance            ?? 0,
    person2RetirementAge:     s?.partnerRetirementAge      ?? 67,
    person2AdditionalContribs:s?.partnerAdditionalContribs ?? 0,
  }

  const context: ProjectionContext = {
    person1Age:          inc.person1Age,
    person1Salary:       inc.person1FTE,
    person1SalaryGrowth: proj.person1Growth / 100,
    person2Age:          inc.person2Age,
    person2Salary:       inc.person2FTE,
    person2SalaryGrowth: proj.person2Growth / 100,
  }

  const mortgageContext = {
    mortgagePaymentMonthly: mtg?.payment ?? 0,
    mortgageEndYear:        mtg?.endDate ? new Date(mtg.endDate).getFullYear() : 9999,
  }

  return (
    <SuperClient
      canEdit={me.role === 'CFO'}
      initial={initial}
      context={context}
      mortgage={mortgageContext}
      budgetAnnualSpend={budgetAnnualSpend}
      retirementSpend={Math.round(spendingInRetirement(budget, expenses) * 12 / 1000) * 1000}
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
      superHistory={superHistory}
      isRenting={rent?.enabled ?? false}
      rentMonthly={rent?.monthlyRent ?? 0}
    />
  )
}
