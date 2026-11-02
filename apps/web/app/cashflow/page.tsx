export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { packagingNow } from '@proviso/core/packaging'
import { businessNow } from '@proviso/core/businessIncome'
import { requireAdult } from '@/lib/auth'
import Link from 'next/link'
import { PPL_WEEKS } from '@proviso/core/constants'
import { fmt, fmtS } from '@proviso/core/formatting'
import { workDaysForYear } from '@proviso/core/projections'
import { computeCashOnHand } from '@proviso/core/netWorth'
import { computeBudgetSummary } from '@proviso/core/budgetSummary'
import { computeCashflow } from '@proviso/core/cashflow'
import Panel from '@/components/ui/Panel'
import CashflowLineChart from '@/components/cashflow/CashflowLineChart'

export default async function CashflowPage() {
  await requireAdult()
  const [income, expenses, person1Phases, person2Phases, assets, hs, projSettings, annualExpenses, rent, childcare, packagedItems, incomeSources] = await Promise.all([
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
    prisma.packagedItem.findMany(),
    prisma.incomeSource.findMany(),
  ])
  const person2Name = hs?.person2Name ?? 'Person 2'
  const partnerEnabled = hs?.partnerEnabled ?? false

  // The Budget's own figures (childcare after the subsidy, rent), so this
  // page, Budget and Home agree; pay follows the plan's work changes and
  // parental leave month by month. The maths is shared with the app
  // (@proviso/core/cashflow).
  const now = new Date()
  const year = now.getFullYear()
  const budgetFor = (d1: number, d2: number) => computeBudgetSummary({
    expenses, annualExpenses, income, childcare,
    rentMonthly: rent?.enabled ? rent.monthlyRent : null,
    person1Days: d1, person2Days: d2,
    partnerEnabled,
    packaging: packagingNow(packagedItems, year, { p1: d1, p2: d2 }),
    business: businessNow(incomeSources, year),
  })
  const month = now.getMonth() + 1
  const budget = budgetFor(workDaysForYear(person1Phases, year, month), workDaysForYear(person2Phases, year, month))
  const cf = computeCashflow({
    budget, annualExpenses, cashOnHand: computeCashOnHand(assets), now,
    plan: {
      phases: { p1: person1Phases, p2: partnerEnabled ? person2Phases : [] },
      incomeFor: (d1, d2) => budgetFor(d1, d2).monthlyIncome,
      parentalLeave: partnerEnabled && projSettings?.parentalLeaveEnabled === true,
    },
  })
  const last = cf.months[cf.months.length - 1]

  return (
    <div className="page">
      <div className="banner">
        <div className="b-item">
          <div className="b-label">Left over each month now</div>
          <div className={`b-value ${cf.monthlySurplus >= 0 ? 'green' : 'red'}`}>{fmtS(cf.monthlySurplus)}</div>
        </div>
        <div className="b-div" />
        <div className="b-item">
          <div className="b-label">Cash now</div>
          <div className="b-value">{fmt(cf.cashOnHand)}</div>
        </div>
        <div className="b-div" />
        <div className="b-item">
          <div className="b-label">{cf.runsOut ? 'Runs out' : 'Lowest point'}</div>
          <div className={`b-value ${cf.runsOut ? 'red' : ''}`}>{cf.runsOut ? cf.runsOut.label : `${fmt(cf.lowest.balance)} in ${cf.lowest.label}`}</div>
        </div>
        <div className="b-div" />
        <div className="b-item">
          <div className="b-label">In two years</div>
          <div className={`b-value ${last.balance >= 0 ? 'green' : 'red'}`}>{fmt(last.balance)}</div>
        </div>
      </div>
      <Panel title="Cash over the next 24 months" dotColor="var(--green)">
        <CashflowLineChart
          labels={cf.months.map(m => m.label)}
          data={cf.months.map(m => m.balance)}
          tone="green"
          note="Yearly bills land in the month they’re due. Pay follows your plan’s work changes and parental leave; prices stay as they are."
        />
      </Panel>
      {cf.payChanges.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <Panel title="Changes to pay" dotColor="var(--pink)">
            <div className="proj-summary">
              {cf.payChanges.map(c => (
                <div key={c.label} className="proj-summary-row">
                  <span>From {c.label}{c.onLeave ? `, ${person2Name} on parental leave` : ''}</span>
                  <strong>{fmt(c.income)} a month</strong>
                </div>
              ))}
            </div>
            <p className="proj-note mt1">
              From the work changes in your plan (<Link href="/projections" className="hint-link">Future → What if? → Work</Link>).
              Parental Leave Pay is after tax, for {PPL_WEEKS} weeks from when leave starts.
            </p>
          </Panel>
        </div>
      )}
      <p className="proj-note mt1">
        Where the money goes each month is on <Link href="/budget" className="hint-link">Spending → Budget</Link>.
      </p>
    </div>
  )
}
