import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { computeHomeOverview, type OverviewTarget } from '@proviso/core/overview'
import { fmt, fmtK } from '@proviso/core/formatting'
import { situationLabels } from '@proviso/core/situation'
import { loadSituation } from '@/lib/situation'

export const dynamic = 'force-dynamic'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Where Home's prompts lead on the web.
const TARGET_HREF: Record<OverviewTarget, string> = { income: '/budget', budget: '/budget', savings: '/debts', eofy: '/eofy' }

// Home: the "are we okay?" overview, in plain language. Every figure here is
// computed the same way as on the tab it links to.
export default async function Home() {
  const me = await requireSession()
  if (me.role === 'CHILD') redirect('/child')
  let hs = await prisma.householdSettings.findUnique({ where: { id: 1 } })
  if (!hs) {
    // Existing install predating the onboarding feature — create a skipped record
    hs = await prisma.householdSettings.upsert({
      where:  { id: 1 },
      update: {},
      create: { id: 1, person1Name: 'You', person2Name: 'Partner', partnerEnabled: true, onboardingDone: true },
    })
  }
  // Only a CFO can save the wizard (budget:write) — others go straight in.
  if (!hs.onboardingDone && me.role === 'CFO') redirect('/onboarding')

  const [expenses, annualExpenses, income, childcare, rent, person1Phases, person2Phases, assets, debts, mortgage, superSettings, snapshots] = await Promise.all([
    prisma.expense.findMany({ orderBy: { id: 'asc' } }),
    prisma.annualExpense.findMany({ orderBy: { month: 'asc' } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.childcareSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.rentSettings.findUnique({ where: { id: 1 } }),
    prisma.person1Phase.findMany({ orderBy: { year: 'asc' } }),
    prisma.person2Phase.findMany({ orderBy: { year: 'asc' } }),
    prisma.asset.findMany(),
    prisma.debt.findMany(),
    prisma.mortgageSettings.findUnique({ where: { id: 1 } }),
    prisma.superSettings.findUnique({ where: { id: 1 } }),
    prisma.netWorthSnapshot.findMany({ orderBy: { takenAt: 'asc' } }),
  ])

  // Every figure comes from the shared overview, so the app shows the same.
  const situation = await loadSituation()
  const o = computeHomeOverview({
    now: new Date(),
    expenses, annualExpenses, income, childcare,
    rentMonthly: rent?.enabled ? rent.monthlyRent : null,
    workPhases: { p1: person1Phases, p2: person2Phases },
    partnerEnabled: hs.partnerEnabled,
    assets, debts, mortgage,
    superBalances: { p1: superSettings?.currentBalance ?? 0, p2: superSettings?.partnerBalance ?? 0 },
    snapshots,
  })
  const { budget, noIncome, left, cash, coverMonths, mortgageLeft, mortgageEndYear, superTotal, upcoming } = o
  const netPosition = o.netWorth
  const change = o.netWorthChange
  const checks = o.checks.map(c => ({ ...c, href: TARGET_HREF[c.target] }))

  const firstName = me.name.trim().split(/\s+/)[0]

  return (
    <div className="page home">
      <p className="home-greeting">Hi {firstName}</p>

      <section className={`home-hero ${noIncome ? '' : left >= 0 ? 'good' : 'bad'}`}>
        <div className="home-hero-label">Each month</div>
        {noIncome ? (
          <div className="home-hero-value">Let&rsquo;s get started</div>
        ) : (
          <>
            <div className="home-hero-value">{fmt(Math.abs(left))} {left >= 0 ? 'left over' : 'short'}</div>
            <div className="home-hero-sub">
              {fmt(budget.monthlyIncome)} comes in after tax, {fmt(budget.monthlyExpenses)} goes out
              (yearly bills spread across the year).
            </div>
          </>
        )}
        <Link href="/budget" className="home-hero-link">See the budget →</Link>
      </section>

      {checks.length > 0 && (
        <section className="home-section">
          <h2 className="home-h2">Worth a look</h2>
          <ul className="home-checks">
            {checks.map(c => (
              <li key={c.text} className={`home-check ${c.tone}`}>
                <span>{c.text}</span>
                <Link href={c.href}>{c.cta}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-section">
        <h2 className="home-h2">Where you stand</h2>
        <div className="home-stats">
          <Link href="/debts" className="home-stat">
            <span className="home-stat-label">Net worth</span>
            <span className="home-stat-value">{fmtK(netPosition)}</span>
            {change ? (
              <span className={`home-stat-sub ${change.amount > 0 ? 'up' : 'down'}`}>
                {change.amount > 0 ? '▲' : '▼'} {fmtK(Math.abs(change.amount))} since {MONTHS[change.since.getMonth()]}
              </span>
            ) : (
              <span className="home-stat-sub">what you own minus what you owe</span>
            )}
            {superTotal > 0 && <span className="home-stat-sub">{fmtK(netPosition + superTotal)} counting super</span>}
          </Link>
          <Link href="/debts" className="home-stat">
            <span className="home-stat-label">Cash safety net</span>
            <span className="home-stat-value">{fmtK(cash)}</span>
            {coverMonths !== null && (
              <span className="home-stat-sub">about {coverMonths >= 12 ? '12+' : coverMonths.toFixed(1)} months of spending</span>
            )}
          </Link>
          {mortgageLeft !== null && (
            <Link href="/debts" className="home-stat">
              <span className="home-stat-label">Home loan left</span>
              <span className="home-stat-value">{fmtK(mortgageLeft)}</span>
              {mortgageEndYear && <span className="home-stat-sub">on track to finish in {mortgageEndYear}</span>}
            </Link>
          )}
          {superTotal > 0 && (
            <Link href="/super" className="home-stat">
              <span className="home-stat-label">Super</span>
              <span className="home-stat-value">{fmtK(superTotal)}</span>
              <span className="home-stat-sub">for retirement; not in net worth, as it&rsquo;s locked until about 60</span>
            </Link>
          )}
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-h2">Coming up</h2>
        {upcoming.length ? (
          <ul className="home-list">
            {upcoming.map(a => (
              <li key={a.id}>
                <span>
                  <strong>{a.name}</strong>
                  <span className="home-list-sub">{a.monthsAway === 0 ? 'this month' : `in ${MONTHS[a.month - 1]}`}</span>
                </span>
                <span className="home-list-amt">{fmt(a.amt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="home-empty">
            No yearly bills due in the next three months.{' '}
            <Link href="/budget">Add things like car rego or insurance</Link> so they never catch you out.
          </p>
        )}
      </section>

      <section className="home-section">
        <h2 className="home-h2">Your situation</h2>
        <div className="home-situation">
          <ul>
            {situationLabels(situation, hs.person2Name).map(l => <li key={l}>{l}</li>)}
          </ul>
          <Link href="/settings#situation">
            {me.role === 'CFO' ? 'Change what applies to you' : 'See what’s included'} →
          </Link>
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-h2">Explore</h2>
        <div className="home-links">
          <Link href="/budget" className="home-link"><strong>Spending</strong><span>Your budget, and what you actually spent</span></Link>
          <Link href="/debts" className="home-link"><strong>Wealth</strong><span>What you own, what you owe, super and investments</span></Link>
          <Link href="/projections" className="home-link"><strong>Future</strong><span>Where you&rsquo;re headed, and &ldquo;what if&rdquo; plans</span></Link>
        </div>
      </section>
    </div>
  )
}
