// Home: the "are we okay?" overview. Every figure is calculated here once, so
// the NAS web app and the phone app show exactly the same numbers and the same
// prompts. Platforms only decide where each prompt's button goes.

import { computeBudgetSummary, upcomingAnnualExpenses, type BudgetSummary, type BudgetExpense, type BudgetAnnualExpense, type BudgetIncome, type BudgetChildcare } from './budgetSummary'
import { computeCashOnHand, computeCurrentNetWorth, NET_WORTH_DEFINED_FROM, type AssetRow, type DebtRow } from './netWorth'
import { workDaysForYear } from './projections'
import { isEofySeason } from './eofy'
import { fmt } from './formatting'

/** Where a prompt's button leads — each platform maps these to its own screens. */
export type OverviewTarget = 'budget' | 'savings' | 'eofy'

export interface OverviewCheck {
  tone:   'red' | 'amber' | 'blue'
  text:   string
  target: OverviewTarget
  cta:    string
}

export interface OverviewInputs<E extends BudgetExpense> {
  now:            Date
  expenses:       E[]
  annualExpenses: (BudgetAnnualExpense & { id: number | string })[]
  income:         BudgetIncome
  childcare:      BudgetChildcare
  /** Monthly rent when renting, else null. */
  rentMonthly:    number | null
  workPhases:     { p1: { year: number; days: number }[]; p2: { year: number; days: number }[] }
  partnerEnabled: boolean
  assets:         AssetRow[]
  debts:          DebtRow[]
  mortgage:       { balance: number; endDate: string } | null
  superBalances:  { p1: number; p2: number }
  snapshots:      { takenAt: Date | string; netWorth: number; totalAssets: number | null; totalDebts: number | null }[]
}

export interface HomeOverview<E extends BudgetExpense> {
  budget:          BudgetSummary<E>
  noIncome:        boolean
  /** Monthly income minus spending (negative = short). */
  left:            number
  checks:          OverviewCheck[]
  netWorth:        number
  /** Change since the oldest snapshot in the last 12 months, under the current definition. */
  netWorthChange:  { amount: number; since: Date } | null
  cash:            number
  coverMonths:     number | null
  /** Home loan still owing; null when renting, unknown, or tracked as a debt row. */
  mortgageLeft:    number | null
  mortgageEndYear: number | null
  superTotal:      number
  upcoming:        ((BudgetAnnualExpense & { id: number | string }) & { monthsAway: number })[]
}

export function computeHomeOverview<E extends BudgetExpense>(i: OverviewInputs<E>): HomeOverview<E> {
  const year = i.now.getFullYear()
  const budget = computeBudgetSummary({
    expenses: i.expenses, annualExpenses: i.annualExpenses, income: i.income, childcare: i.childcare,
    rentMonthly: i.rentMonthly,
    person1Days: workDaysForYear(i.workPhases.p1, year),
    person2Days: workDaysForYear(i.workPhases.p2, year),
    partnerEnabled: i.partnerEnabled,
  })

  // Same figure as Wealth → Own & owe: everything owned minus owed.
  const { netWorth } = computeCurrentNetWorth(i.debts, i.assets, i.mortgage)
  // Change since the oldest snapshot from the last 12 months that had data —
  // only snapshots taken under the current net-worth definition compare.
  const yearAgo = new Date(i.now); yearAgo.setFullYear(year - 1)
  const from = Math.max(yearAgo.getTime(), NET_WORTH_DEFINED_FROM.getTime())
  const since = [...i.snapshots]
    .map(s => ({ ...s, at: new Date(s.takenAt) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .find(s => s.at.getTime() >= from && ((s.totalAssets ?? 0) !== 0 || (s.totalDebts ?? 0) !== 0))
  const netWorthChange = since && netWorth !== since.netWorth ? { amount: netWorth - since.netWorth, since: since.at } : null

  const cash = computeCashOnHand(i.assets)
  const coverMonths = budget.monthlyExpenses > 0 ? cash / budget.monthlyExpenses : null
  const hasMortgageDebt = i.debts.some(d => /mortgage/i.test(d.name))
  const mortgageLeft = hasMortgageDebt || i.rentMonthly !== null ? null
    : (i.mortgage && i.mortgage.balance > 0 ? i.mortgage.balance : null)
  const mortgageEndYear = i.mortgage?.endDate ? Number(i.mortgage.endDate.slice(0, 4)) || null : null
  const superTotal = i.superBalances.p1 + (i.partnerEnabled ? i.superBalances.p2 : 0)

  const noIncome = budget.monthlyIncome <= 0
  const left = budget.delta

  // Plain-language prompts, most important first.
  const checks: OverviewCheck[] = []
  if (noIncome) {
    checks.push({ tone: 'blue', text: 'Add your take-home pay so we can work out what you have left each month.', target: 'budget', cta: 'Add income' })
  } else if (left < 0) {
    checks.push({ tone: 'red', text: `You're spending ${fmt(-left)} more than you bring in each month.`, target: 'budget', cta: 'Review budget' })
  }
  if (coverMonths !== null && coverMonths < 3) {
    checks.push({ tone: 'amber', text: `Your cash would cover about ${coverMonths < 1 ? 'less than a month' : `${coverMonths.toFixed(1)} months`} of spending. Three to six months is a common safety net.`, target: 'savings', cta: 'See savings' })
  }
  if (isEofySeason(i.now)) {
    checks.push({ tone: 'blue', text: 'Tax time is coming up. The end-of-year checklist helps you get ready.', target: 'eofy', cta: 'Open checklist' })
  }

  return {
    budget, noIncome, left, checks, netWorth, netWorthChange, cash, coverMonths,
    mortgageLeft, mortgageEndYear, superTotal,
    upcoming: upcomingAnnualExpenses(i.annualExpenses, i.now),
  }
}
