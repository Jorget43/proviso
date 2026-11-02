// The next two years, month by month: cash in the bank if pay and spending
// stay as they are today, with each yearly bill landing in the month it's
// due rather than spread out. Shared by the NAS's "Next 2 years" page and the
// app's, so the two can't disagree.
//
// Regular monthly spending is the Budget's own figure (computeBudgetSummary:
// regular lines, childcare after the subsidy, rent) less the yearly bills it
// spreads across the year — those are charged in their months here instead.
// So over a whole year this ends at the same place as Home's "left over".
//
// Pay follows the plan's work pattern month by month (the same work changes
// and parental leave the projection uses, schema v14 months): with `plan`,
// each month's take-home is worked out for the days each person works that
// month, and the partner's Parental Leave Pay (after tax) is paid for
// PPL_MONTHS from when their leave starts. Without it, today's pay throughout.

import { calcAfterTax } from './tax'
import { PPL_TOTAL, PPL_MONTHS } from './constants'
import { workDaysForYear, type WorkPhase } from './projections'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Nov 26": short month and two-digit year, the same in every locale. */
export const monthLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${String(year).slice(-2)}`

export interface CashflowPlan {
  phases: { p1: WorkPhase[]; p2: WorkPhase[] }
  /** Take-home a month with these days a week (computeBudgetSummary's monthlyIncome). */
  incomeFor: (p1Days: number, p2Days: number) => number
  /** The partner's leave is paid Parental Leave Pay (a partner, and the switch on). */
  parentalLeave: boolean
}

export interface CashflowInputs {
  /** From computeBudgetSummary: monthly after-tax income and monthly spending (yearly bills spread). */
  budget:         { monthlyIncome: number; monthlyExpenses: number }
  annualExpenses: { name: string; amt: number; month: number }[]
  /** Cash available today (computeCashOnHand). */
  cashOnHand:     number
  /** The plan's work pattern; without it, today's pay every month. */
  plan?:          CashflowPlan
  now:            Date
  months?:        number
}

export interface CashflowMonth {
  year:       number
  month:      number    // 1–12
  label:      string
  bills:      { name: string; amt: number }[]
  billsTotal: number
  /** Take-home pay that month (Parental Leave Pay included). */
  income:     number
  /** The partner is on parental leave that month. */
  onLeave:    boolean
  /** Cash at the end of the month. */
  balance:    number
}

export interface Cashflow {
  /** Take-home a month now. */
  monthlyIn:      number
  /** Regular monthly spending, without yearly bills. */
  monthlyOut:     number
  monthlySurplus: number
  cashOnHand:     number
  months:         CashflowMonth[]
  /** The month with the least cash. */
  lowest:         CashflowMonth
  /** The first month cash goes below zero, if it does. */
  runsOut:        CashflowMonth | null
  /** Months where take-home pay changes from the month before, with the new amount. */
  payChanges:     { label: string; income: number; onLeave: boolean }[]
}

export function computeCashflow(i: CashflowInputs): Cashflow {
  const n = i.months ?? 24
  const annualTotal = i.annualExpenses.reduce((s, a) => s + a.amt, 0)
  const monthlyIn = i.budget.monthlyIncome
  const monthlyOut = i.budget.monthlyExpenses - annualTotal / 12
  const plan = i.plan

  // Parental Leave Pay is taxable: its after-tax amount, spread over the months it's paid.
  const pplNetMonthly = calcAfterTax(PPL_TOTAL) / PPL_MONTHS
  const leaveStarts = plan?.parentalLeave
    ? plan.phases.p2.filter(p => p.days === 0).map(p => p.year * 12 + (p.month ?? 1) - 1)
    : []
  const incomeCache = new Map<string, number>()
  const incomeAt = (year: number, month: number) => {
    if (!plan) return { income: monthlyIn, onLeave: false }
    const d1 = workDaysForYear(plan.phases.p1, year, month)
    const d2 = workDaysForYear(plan.phases.p2, year, month)
    const k = `${d1}/${d2}`
    if (!incomeCache.has(k)) incomeCache.set(k, plan.incomeFor(d1, d2))
    const at = year * 12 + month - 1
    const ppl = leaveStarts.some(s => at >= s && at < s + PPL_MONTHS) ? pplNetMonthly : 0
    return { income: incomeCache.get(k)! + ppl, onLeave: plan.parentalLeave && d2 === 0 }
  }

  const months: CashflowMonth[] = []
  let balance = i.cashOnHand
  for (let k = 1; k <= n; k++) {
    const d = new Date(i.now.getFullYear(), i.now.getMonth() + k, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const bills = i.annualExpenses.filter(a => a.month === month).map(a => ({ name: a.name, amt: a.amt }))
    const billsTotal = bills.reduce((s, b) => s + b.amt, 0)
    const { income, onLeave } = incomeAt(year, month)
    balance += income - monthlyOut - billsTotal
    months.push({ year, month, label: monthLabel(year, month), bills, billsTotal, income: Math.round(income), onLeave, balance: Math.round(balance) })
  }

  const lowest = months.reduce((lo, m) => (m.balance < lo.balance ? m : lo), months[0])
  const payChanges = months
    .filter((m, k) => Math.abs(m.income - (k ? months[k - 1].income : Math.round(monthlyIn))) >= 1)
    .map(m => ({ label: m.label, income: m.income, onLeave: m.onLeave }))
  return {
    monthlyIn, monthlyOut, monthlySurplus: monthlyIn - monthlyOut, cashOnHand: i.cashOnHand, months, lowest,
    runsOut: months.find(m => m.balance < 0) ?? null,
    payChanges,
  }
}
