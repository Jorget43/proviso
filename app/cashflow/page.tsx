export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import { calcAfterTax } from '@/lib/tax'
import { toMonthly } from '@/lib/formatting'
import { CATS, PPL_TOTAL, PPL_MONTHS, PPL_WEEKS } from '@/lib/constants'
import { workDaysForYear } from '@/lib/projections'
import { computeCashOnHand } from '@/lib/netWorth'
import Panel from '@/components/ui/Panel'
import CashflowBanner from '@/components/cashflow/CashflowBanner'
import CashflowLineChart from '@/components/cashflow/CashflowLineChart'
import IncVsExpChart from '@/components/cashflow/IncVsExpChart'

export default async function CashflowPage() {
  await requireAdult()
  const [income, expenses, person1Phases, person2Phases, assets, hs, projSettings, annualExpenses] = await Promise.all([
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.expense.findMany(),
    prisma.person1Phase.findMany(),
    prisma.person2Phase.findMany(),
    prisma.asset.findMany(),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.projectionSettings.findUnique({ where: { id: 1 } }),
    prisma.annualExpense.findMany(),
  ])
  const person1Name = hs?.person1Name ?? 'Person 1'
  const person2Name = hs?.person2Name ?? 'Person 2'

  const partnerEnabled = hs?.partnerEnabled ?? false

  // Same income rule as the Budget tab and the Projections engine: gross
  // pro-rated by this year's work days, HELP applied per person.
  const currentYear = new Date().getFullYear()
  const person1Days = workDaysForYear(person1Phases, currentYear)
  const person2Days = workDaysForYear(person2Phases, currentYear)

  const cashOnHand = computeCashOnHand(assets)

  // Monthly net income
  const person1Net = income.taxMode
    ? calcAfterTax(income.person1FTE * (person1Days / 5), income.person1HasHELP) / 12
    : income.person1MonthlyNet

  const person2Net = !partnerEnabled ? 0 : income.taxMode
    ? calcAfterTax(income.person2FTE * (person2Days / 5), income.person2HasHELP) / 12
    : income.person2MonthlyNet

  const totalInc = person1Net + person2Net
  // Annual expenses are NOT in totalExp — they're charged in their due month
  // below (cumulatively), so the line shows the real dips.
  const totalExp = expenses.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)
  const delta = totalInc - totalExp

  // PPL is taxable: spread its after-tax amount over the months it's paid.
  const pplNetMonthly = calcAfterTax(PPL_TOTAL) / PPL_MONTHS
  const leaveDelta = person1Net + pplNetMonthly - totalExp
  const burnDelta  = person1Net - totalExp
  const runway     = burnDelta < 0 ? cashOnHand / Math.abs(burnDelta) : Infinity

  // Annual expense hits by calendar month (1-12)
  const lumpyByMonth: Record<number, number> = {}
  annualExpenses.forEach(l => { lumpyByMonth[l.month] = (lumpyByMonth[l.month] ?? 0) + l.amt })

  // 24-month arrays
  const now = new Date()
  const n = 24

  // Running total of annual-expense hits up to and including month i, so a
  // payment keeps reducing the balance in every later month too.
  const lumpyCumulative: number[] = []
  for (let i = 0, run = 0; i < n; i++) {
    const d = new Date(now)
    d.setMonth(d.getMonth() + i + 1)
    run += lumpyByMonth[d.getMonth() + 1] ?? 0
    lumpyCumulative.push(run)
  }
  const labels = Array.from({ length: n }, (_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() + i + 1)
    return d.toLocaleString('default', { month: 'short', year: '2-digit' })
  })

  const cfData = Array.from({ length: n }, (_, i) =>
    Math.round(cashOnHand + delta * (i + 1) - lumpyCumulative[i])
  )

  const burnData = Array.from({ length: n }, (_, i) => {
    const pm   = Math.min(i + 1, PPL_MONTHS)
    const post = Math.max(0, i + 1 - PPL_MONTHS)
    return Math.max(0, Math.round(
      cashOnHand + pm * leaveDelta + post * (person1Net - totalExp) - lumpyCumulative[i]
    ))
  })

  // Category monthly for inc vs exp chart
  const catMonthly: Record<string, number> = {}
  CATS.forEach(c => { catMonthly[c] = 0 })
  expenses.forEach(e => { catMonthly[e.cat] = (catMonthly[e.cat] ?? 0) + toMonthly(e.amt, e.freq) })

  const showLeave = partnerEnabled && projSettings?.parentalLeaveEnabled === true

  return (
    <div className="page">
      <CashflowBanner
        delta={delta}
        leaveDelta={leaveDelta}
        burnDelta={burnDelta}
        cashOnHand={cashOnHand}
        runway={runway}
        person1Name={person1Name}
        person2Name={person2Name}
        showLeave={showLeave}
      />
      <div className={showLeave ? 'two-col' : undefined}>
        <Panel title={showLeave ? 'Next 24 months (both working)' : 'Cash over the next 24 months'} dotColor="var(--green)">
          <CashflowLineChart
            labels={labels}
            data={cfData}
            color="#166B45"
            note="Yearly bills land in the month they're due."
          />
        </Panel>
        {showLeave && (
          <Panel title="Parental leave scenario" dotColor="var(--pink)">
            <CashflowLineChart
              labels={labels}
              data={burnData}
              color="#9B2560"
              note={`${person2Name} on leave — PPL for ${PPL_WEEKS} wks (after tax), then ${person1Name} only.`}
            />
          </Panel>
        )}
      </div>
      <div style={{ marginTop: '1rem' }}>
        <Panel title="Income vs expenses by category" dotColor="var(--blue)">
          <IncVsExpChart totalInc={totalInc} catMonthly={catMonthly} />
        </Panel>
      </div>
    </div>
  )
}
