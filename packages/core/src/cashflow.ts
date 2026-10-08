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
// With parental leave switched on (and a partner), a second line: the
// partner on leave, paid Parental Leave Pay (after tax) for its first
// PPL_MONTHS, then one income only.

import { calcAfterTax } from './tax'
import { PPL_TOTAL, PPL_MONTHS } from './constants'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Nov 26": short month and two-digit year, the same in every locale. */
export const monthLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${String(year).slice(-2)}`

export interface CashflowInputs {
  /** From computeBudgetSummary: monthly after-tax income, monthly spending (yearly bills spread), person 1's monthly take-home. */
  budget:         { monthlyIncome: number; monthlyExpenses: number; person1Net: number }
  annualExpenses: { name: string; amt: number; month: number }[]
  /** Cash available today (computeCashOnHand). */
  cashOnHand:     number
  /** Parental leave switched on, with a partner. */
  parentalLeave:  boolean
  now:            Date
  months?:        number
}

export interface CashflowMonth {
  year:         number
  month:        number    // 1–12
  label:        string
  bills:        { name: string; amt: number }[]
  billsTotal:   number
  /** Cash at the end of the month. */
  balance:      number
  /** The same, with the partner on parental leave from next month; null when that doesn't apply. */
  leaveBalance: number | null
}

export interface Cashflow {
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
  leave: {
    /** Each month while Parental Leave Pay lasts. */
    onPplSurplus:    number
    /** Each month after, on one income. */
    afterPplSurplus: number
    /** Months today's cash lasts on one income (Infinity when it covers spending). */
    runwayMonths:    number
    runsOut:         CashflowMonth | null
  } | null
}

export function computeCashflow(i: CashflowInputs): Cashflow {
  const n = i.months ?? 24
  const annualTotal = i.annualExpenses.reduce((s, a) => s + a.amt, 0)
  const monthlyIn = i.budget.monthlyIncome
  const monthlyOut = i.budget.monthlyExpenses - annualTotal / 12
  const monthlySurplus = monthlyIn - monthlyOut

  // Parental Leave Pay is taxable: its after-tax amount, spread over the months it's paid.
  const pplNetMonthly = calcAfterTax(PPL_TOTAL) / PPL_MONTHS
  const onPplSurplus = i.budget.person1Net + pplNetMonthly - monthlyOut
  const afterPplSurplus = i.budget.person1Net - monthlyOut

  const months: CashflowMonth[] = []
  let billsSoFar = 0
  for (let k = 1; k <= n; k++) {
    const d = new Date(i.now.getFullYear(), i.now.getMonth() + k, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const bills = i.annualExpenses.filter(a => a.month === month).map(a => ({ name: a.name, amt: a.amt }))
    const billsTotal = bills.reduce((s, b) => s + b.amt, 0)
    billsSoFar += billsTotal
    const onPpl = Math.min(k, PPL_MONTHS)
    const after = Math.max(0, k - PPL_MONTHS)
    months.push({
      year, month, label: monthLabel(year, month), bills, billsTotal,
      balance: Math.round(i.cashOnHand + monthlySurplus * k - billsSoFar),
      leaveBalance: i.parentalLeave ? Math.round(i.cashOnHand + onPplSurplus * onPpl + afterPplSurplus * after - billsSoFar) : null,
    })
  }

  const lowest = months.reduce((lo, m) => (m.balance < lo.balance ? m : lo), months[0])
  return {
    monthlyIn, monthlyOut, monthlySurplus, cashOnHand: i.cashOnHand, months, lowest,
    runsOut: months.find(m => m.balance < 0) ?? null,
    leave: i.parentalLeave ? {
      onPplSurplus, afterPplSurplus,
      runwayMonths: afterPplSurplus < 0 ? i.cashOnHand / -afterPplSurplus : Infinity,
      runsOut: months.find(m => (m.leaveBalance ?? 0) < 0) ?? null,
    } : null,
  }
}
