import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { workDaysForYear } from '@/lib/projections'
import { computeCashOnHand, computeCurrentNetWorth, NET_WORTH_DEFINED_FROM } from '@/lib/netWorth'
import { computeBudgetSummary, upcomingAnnualExpenses } from '@/lib/budgetSummary'
import { isEofySeason } from '@/lib/eofy'
import { fmt, fmtK } from '@/lib/formatting'
import { loadSituation, situationLabels } from '@/lib/situation'

export const dynamic = 'force-dynamic'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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

  const now = new Date()
  const year = now.getFullYear()
  const budget = computeBudgetSummary({
    expenses, annualExpenses, income, childcare,
    rentMonthly: rent?.enabled ? rent.monthlyRent : null,
    person1Days: workDaysForYear(person1Phases, year),
    person2Days: workDaysForYear(person2Phases, year),
    partnerEnabled: hs.partnerEnabled,
  })

  // Same figure as Wealth → Own & owe: everything listed as owned minus owed.
  const { netWorth: netPosition } = computeCurrentNetWorth(debts, assets, mortgage)
  // Change since the oldest snapshot from the last 12 months that had data —
  // only snapshots taken under the current net-worth definition compare.
  const yearAgo = new Date(now); yearAgo.setFullYear(year - 1)
  const from = new Date(Math.max(yearAgo.getTime(), NET_WORTH_DEFINED_FROM.getTime()))
  const since = snapshots.find(s => s.takenAt >= from && ((s.totalAssets ?? 0) !== 0 || (s.totalDebts ?? 0) !== 0))
  const change = since ? netPosition - since.netWorth : null

  const situation = await loadSituation()
  const cash = computeCashOnHand(assets)
  const coverMonths = budget.monthlyExpenses > 0 ? cash / budget.monthlyExpenses : null
  const hasMortgageDebt = debts.some(d => /mortgage/i.test(d.name))
  const mortgageLeft = hasMortgageDebt || situation.renting ? null : (mortgage && mortgage.balance > 0 ? mortgage.balance : null)
  const mortgageEndYear = mortgage?.endDate ? Number(mortgage.endDate.slice(0, 4)) : null
  const superTotal = (superSettings?.currentBalance ?? 0) + (hs.partnerEnabled ? (superSettings?.partnerBalance ?? 0) : 0)

  const upcoming = upcomingAnnualExpenses(annualExpenses, now)
  const noIncome = budget.monthlyIncome <= 0
  const left = budget.delta

  // Plain-language prompts, most important first.
  const checks: { tone: 'red' | 'amber' | 'blue'; text: string; href: string; cta: string }[] = []
  if (noIncome) {
    checks.push({ tone: 'blue', text: 'Add your take-home pay so we can work out what you have left each month.', href: '/budget', cta: 'Add income' })
  } else if (left < 0) {
    checks.push({ tone: 'red', text: `You're spending ${fmt(-left)} more than you bring in each month.`, href: '/budget', cta: 'Review budget' })
  }
  if (coverMonths !== null && coverMonths < 3) {
    checks.push({ tone: 'amber', text: `Your cash would cover about ${coverMonths < 1 ? 'less than a month' : `${coverMonths.toFixed(1)} months`} of spending. Three to six months is a common safety net.`, href: '/debts', cta: 'See savings' })
  }
  if (isEofySeason(now)) {
    checks.push({ tone: 'blue', text: 'Tax time is coming up. The end-of-year checklist helps you get ready.', href: '/eofy', cta: 'Open checklist' })
  }

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
            {change !== null && change !== 0 && since ? (
              <span className={`home-stat-sub ${change > 0 ? 'up' : 'down'}`}>
                {change > 0 ? '▲' : '▼'} {fmtK(Math.abs(change))} since {MONTHS[since.takenAt.getMonth()]}
              </span>
            ) : (
              <span className="home-stat-sub">what you own minus what you owe</span>
            )}
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
              <span className="home-stat-sub">for retirement</span>
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
