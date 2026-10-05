// HELP/HECS indexation alert engine (Phase 2A)
//
// CPI indexation applies on 1 June each year. The ATO indexes the *opening*
// FY balance minus any voluntary payments made directly to the ATO before
// June 1. PAYG amounts withheld by employers throughout the year do NOT reduce
// the indexable amount — they are credited to the debt *after* indexation.
// That distinction is the whole reason a voluntary prepayment is valuable.

import { marginalRate } from './tax'

// Indexation falls on 1 June of the financial-year-ending year.
export const INDEXATION_MONTH = 6 // June (1-indexed)
export const INDEXATION_DAY = 1

// How far ahead of 1 June the alert starts surfacing (~3 months → from March).
export const ALERT_WINDOW_DAYS = 92

export interface HelpAlertInput {
  member: string
  financialYearEnding: number
  // Balance at 1 July — the ATO's indexation base
  openingFyBalance: number
  // Direct voluntary payments to the ATO before 1 June — these DO reduce indexation
  voluntaryRepayments: number
  // CPI indexation rate as a percentage, e.g. 3.5
  cpiRate: number
  // Gross income, used to express the saving as a marginal-rate equivalent
  grossIncome: number
}

export interface HelpAlert {
  member: string
  financialYearEnding: number
  // opening − voluntary, floored at 0
  indexableBase: number
  // indexableBase × cpiRate%
  increase: number
  cpiRate: number
  // Marginal rate (incl. Medicare levy) as a fraction
  marginalRate: number
  // Pre-tax investment return needed to match a guaranteed, tax-free cpiRate%
  preTaxEquivReturn: number
  // Paying this much before 1 June avoids the indexation entirely
  suggestedPayment: number
  // Dollars of indexation avoided by paying suggestedPayment
  saving: number
}

// Local-time 1 June of the given FY-ending year.
export function indexationDate(financialYearEnding: number): Date {
  return new Date(financialYearEnding, INDEXATION_MONTH - 1, INDEXATION_DAY)
}

// Whole days from `now` until 1 June. Negative once indexation has passed.
export function daysUntilIndexation(financialYearEnding: number, now: Date = new Date()): number {
  const ms = indexationDate(financialYearEnding).getTime() - now.getTime()
  return Math.ceil(ms / 86_400_000)
}

export function isPostIndexation(financialYearEnding: number, now: Date = new Date()): boolean {
  return now >= indexationDate(financialYearEnding)
}

// True when 1 June is still ahead and within the alert window.
export function isInAlertWindow(financialYearEnding: number, now: Date = new Date()): boolean {
  const days = daysUntilIndexation(financialYearEnding, now)
  return days > 0 && days <= ALERT_WINDOW_DAYS
}

export function computeHelpAlert(input: HelpAlertInput): HelpAlert {
  const indexableBase = Math.max(0, input.openingFyBalance - input.voluntaryRepayments)
  const increase = indexableBase * (input.cpiRate / 100)
  const mr = marginalRate(input.grossIncome)
  // Avoiding indexation is a guaranteed, tax-free cpiRate%. To match it after
  // tax, an investment must return cpiRate / (1 − marginalRate) pre-tax.
  const preTaxEquivReturn = mr < 1 ? input.cpiRate / (1 - mr) : input.cpiRate

  return {
    member: input.member,
    financialYearEnding: input.financialYearEnding,
    indexableBase,
    increase,
    cpiRate: input.cpiRate,
    marginalRate: mr,
    preTaxEquivReturn,
    suggestedPayment: indexableBase,
    saving: increase,
  }
}
