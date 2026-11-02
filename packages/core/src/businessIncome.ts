// Business income (plan item 5b): profit from a business, sole trading or
// gig work, in someone's name.
//
//   - Profit is taxed on top of the person's other taxable income (pay less
//     salary sacrifice and packaging), so it's taxed at their marginal rate,
//     with the Medicare levy.
//   - It counts for HELP repayments (repayment income is taxable income plus
//     reportable amounts).
//   - No compulsory super is paid on it.
//   - Amounts are profit, $0 or more. A loss counts as nothing: most side
//     businesses can't take one off salary (ATO non-commercial loss rules).
//   - With no end year, it stops when the person stops work. An end year
//     after retirement models work kept up in retirement.
//
// Not modelled: GST, PAYG instalments (tax is taken in the year earned),
// personal services income rules, the small business income tax offset,
// and deductible personal super contributions.

import { taxOnTop } from './investmentIncome'
import { calcHELPRepayment } from './tax'

export type IncomeKind = 'business'
export const INCOME_KINDS: readonly IncomeKind[] = ['business']

/** Profit growth a year when none is set: about wage growth. */
export const DEFAULT_BUSINESS_GROWTH = 3

export interface IncomeSourceLike {
  person:    'p1' | 'p2' | string
  /** An IncomeKind; unknown kinds (from newer versions) are ignored. */
  kind:      string
  /** Profit a year before tax, in this year's dollars. */
  amount:    number
  /** % a year the profit grows. */
  growthPct: number
  startYear: number
  /** The last year it runs; null: until the person stops work. */
  endYear:   number | null
}

const isKind = (k: string): k is IncomeKind => (INCOME_KINDS as readonly string[]).includes(k)

/**
 * One person's business profit in `year`, grown from `baseYear` (this year).
 * `working` is false once they've retired: items with no end year stop then.
 */
export function businessProfit(items: IncomeSourceLike[], person: 'p1' | 'p2', year: number, baseYear: number, working: boolean): number {
  return items
    .filter(s => s.person === person && isKind(s.kind) && s.startYear <= year
      && (s.endYear === null ? working : year <= s.endYear))
    .reduce((t, s) => t + Math.max(0, s.amount) * Math.pow(1 + (s.growthPct || 0) / 100, Math.max(0, year - baseYear)), 0)
}

/** This year's profit per person, for today's budget (computeBudgetSummary's `business`). */
export const businessNow = (items: IncomeSourceLike[], year: number): { p1: number; p2: number } =>
  ({ p1: businessProfit(items, 'p1', year, year, true), p2: businessProfit(items, 'p2', year, year, true) })

export interface BusinessYear {
  profit: number
  tax:    number
  /** Extra HELP repaid because of the profit (capped at what's still owed). */
  help:   number
  /** What reaches cash: profit less tax and HELP. */
  cash:   number
}

/**
 * Tax and HELP on a person's profit. `taxable` is their other taxable
 * income; `helpIncome` their other HELP repayment income; `helpLeft` the
 * HELP still owed after what their other income repays (0: no HELP).
 */
export function businessYear(profit: number, taxable: number, helpIncome: number, helpLeft: number): BusinessYear {
  const p = Math.max(0, profit)
  if (p === 0) return { profit: 0, tax: 0, help: 0, cash: 0 }
  const tax = taxOnTop(taxable, p, 0)
  const help = helpLeft > 0
    ? Math.min(helpLeft, Math.max(0, calcHELPRepayment(helpIncome + p) - calcHELPRepayment(helpIncome)))
    : 0
  return { profit: p, tax, help, cash: p - tax - help }
}
