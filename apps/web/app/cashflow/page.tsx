export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import { CATS, PPL_WEEKS } from '@proviso/core/constants'
import { workDaysForYear } from '@proviso/core/projections'
import { computeCashOnHand } from '@proviso/core/netWorth'
import { computeBudgetSummary } from '@proviso/core/budgetSummary'
import { computeCashflow } from '@proviso/core/cashflow'
import Panel from '@/components/ui/Panel'
import CashflowBanner from '@/components/cashflow/CashflowBanner'
import CashflowLineChart from '@/components/cashflow/CashflowLineChart'
import IncVsExpChart from '@/components/cashflow/IncVsExpChart'

export default async function CashflowPage() {
  await requireAdult()
  const [income, expenses, person1Phases, person2Phases, assets, hs, projSettings, annualExpenses, rent, childcare] = await Promise.all([
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.expense.findMany(),
    prisma.person1Phase.findMany(),
    prisma.person2Phase.findMany(),
    prisma.asset.findMany(),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.projectionSettings.findUnique({ where: { id: 1 } }),
    prisma.annualExpense.findMany(),
    prisma.rentSettings.findFirst(),
    prisma.childcareSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  ])
  const person1Name = hs?.person1Name ?? 'Person 1'
  const person2Name = hs?.person2Name ?? 'Person 2'
  const partnerEnabled = hs?.partnerEnabled ?? false
  const showLeave = partnerEnabled && projSettings?.parentalLeaveEnabled === true

  // The Budget's own figures (childcare after the subsidy, rent), so this
  // page, Budget and Home agree; the month-by-month maths is shared with the
  // app (@proviso/core/cashflow).
  const year = new Date().getFullYear()
  const budget = computeBudgetSummary({
    expenses, annualExpenses, income, childcare,
    rentMonthly: rent?.enabled ? rent.monthlyRent : null,
    person1Days: workDaysForYear(person1Phases, year), person2Days: workDaysForYear(person2Phases, year),
    partnerEnabled,
  })
  const cf = computeCashflow({ budget, annualExpenses, cashOnHand: computeCashOnHand(assets), parentalLeave: showLeave, now: new Date() })

  const labels = cf.months.map(m => m.label)
  const cfData = cf.months.map(m => m.balance)
  const burnData = cf.months.map(m => Math.max(0, m.leaveBalance ?? 0))

  // Income vs spending by category: regular lines only (yearly bills land in their months above).
  const catMonthly: Record<string, number> = {}
  CATS.forEach(c => { catMonthly[c] = budget.catMonthly[c] ?? 0 })
  annualExpenses.forEach(a => { catMonthly[a.cat] = (catMonthly[a.cat] ?? 0) - a.amt / 12 })

  return (
    <div className="page">
      <CashflowBanner
        delta={cf.monthlySurplus}
        leaveDelta={cf.leave?.onPplSurplus ?? 0}
        burnDelta={cf.leave?.afterPplSurplus ?? 0}
        cashOnHand={cf.cashOnHand}
        runway={cf.leave?.runwayMonths ?? Infinity}
        person1Name={person1Name}
        person2Name={person2Name}
        showLeave={showLeave}
      />
      <div className={showLeave ? 'two-col' : undefined}>
        <Panel title={showLeave ? 'Next 24 months (both working)' : 'Cash over the next 24 months'} dotColor="var(--green)">
          <CashflowLineChart
            labels={labels}
            data={cfData}
            tone="green"
            note="Yearly bills land in the month they're due."
          />
        </Panel>
        {showLeave && (
          <Panel title="Parental leave scenario" dotColor="var(--pink)">
            <CashflowLineChart
              labels={labels}
              data={burnData}
              tone="pink"
              note={`${person2Name} on leave — PPL for ${PPL_WEEKS} wks (after tax), then ${person1Name} only.`}
            />
          </Panel>
        )}
      </div>
      <div style={{ marginTop: '1rem' }}>
        <Panel title="Income vs expenses by category" dotColor="var(--blue)">
          <IncVsExpChart totalInc={cf.monthlyIn} catMonthly={catMonthly} />
        </Panel>
      </div>
    </div>
  )
}
