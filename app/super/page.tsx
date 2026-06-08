export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { toMonthly } from '@/lib/formatting'
import SuperClient from '@/components/super/SuperClient'
import type { HouseholdSuperInputs, ProjectionContext } from '@/lib/super'

export default async function SuperPage() {
  await requireSession()
  const [s, inc, proj, mtg, expenses, hs, superHistory] = await Promise.all([
    prisma.superSettings.findFirst(),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.mortgageSettings.findFirst(),
    prisma.expense.findMany(),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.superHistory.findMany({ orderBy: { financialYearEnding: 'desc' } }),
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
    jorgeBalance:             s?.currentBalance            ?? 164000,
    jorgeRetirementAge:       s?.retirementAge             ?? 67,
    jorgeAdditionalContribs:  s?.additionalContribs        ?? 0,
    partnerEnabled:           s?.partnerEnabled            ?? true,
    graceBalance:             s?.partnerBalance            ?? 80000,
    graceRetirementAge:       s?.partnerRetirementAge      ?? 67,
    graceAdditionalContribs:  s?.partnerAdditionalContribs ?? 0,
  }

  const context: ProjectionContext = {
    jorgeAge:          inc.jorgeAge,
    jorgeSalary:       inc.jorgeFTE,
    jorgeSalaryGrowth: proj.jorgeGrowth / 100,
    graceAge:          inc.graceAge,
    graceSalary:       inc.graceFTE,
    graceSalaryGrowth: proj.graceGrowth / 100,
  }

  const mortgageContext = {
    mortgagePaymentMonthly: mtg?.payment ?? 0,
    mortgageEndYear:        mtg?.endDate ? new Date(mtg.endDate).getFullYear() : 9999,
  }

  return (
    <SuperClient
      initial={initial}
      context={context}
      mortgage={mortgageContext}
      budgetAnnualSpend={budgetAnnualSpend}
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
      superHistory={superHistory}
    />
  )
}
