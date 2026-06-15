export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { toMonthly } from '@/lib/formatting'
import SuperClient from '@/components/super/SuperClient'
import type { HouseholdSuperInputs, ProjectionContext } from '@/lib/super'

export default async function SuperPage() {
  const me = await requireSession()
  const [s, inc, proj, mtg, expenses, hs, superHistory, rent] = await Promise.all([
    prisma.superSettings.findFirst(),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.mortgageSettings.findFirst(),
    prisma.expense.findMany(),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.superHistory.findMany({ orderBy: { financialYearEnding: 'desc' } }),
    prisma.rentSettings.findFirst(),
  ])

  // Budget-derived annual spend in today's dollars (rounded to nearest $1k)
  const budgetAnnualSpend = Math.round(
    expenses.reduce((sum, e) => sum + toMonthly(e.amt, e.freq), 0) * 12 / 1000
  ) * 1000

  // Use budget spend as the retirement income default if the DB still has the
  // schema placeholder value (80000), i.e. the user hasn't explicitly saved a goal
  const savedIncome = s?.desiredRetirementIncome ?? 80000
  const retirementIncome = savedIncome === 80000 ? budgetAnnualSpend : savedIncome

  const initial: HouseholdSuperInputs = {
    sgRate:                   s?.sgRate                    ?? 0.12,
    investmentReturn:         s?.investmentReturn          ?? 0.06,
    fundFeePercent:           s?.fundFeePercent            ?? 0.005,
    inflationRate:            s?.inflationRate             ?? 0.04,
    desiredRetirementIncome:  retirementIncome,
    person1Balance:           s?.currentBalance            ?? 164000,
    person1RetirementAge:     s?.retirementAge             ?? 67,
    person1AdditionalContribs:s?.additionalContribs        ?? 0,
    partnerEnabled:           s?.partnerEnabled            ?? true,
    person2Balance:           s?.partnerBalance            ?? 80000,
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
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
      superHistory={superHistory}
      isRenting={rent?.enabled ?? false}
      rentMonthly={rent?.monthlyRent ?? 0}
    />
  )
}
