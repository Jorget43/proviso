// The Future: what goes into the projection and super engines, assembled once
// from household data so the NAS web app and the app model the same thing.
//
// Two steps, because the NAS edits settings live on the page:
//   projectionBaseline(...)    – today's position from stored data (expenses,
//                                net worth parts, HELP balances).
//   buildProjectionInputs(...) – baseline + the settings being modelled.
//
// Expenses: the projection starts from the same monthly spending the budget
// shows (regular lines, yearly bills spread over 12 months, childcare after
// the subsidy), minus the parts the engine models itself:
//   - rent (grows at its own rate; stops at a planned purchase),
//   - the home-loan repayment (paid un-inflated, stops at payoff),
//   - school costs for the children whose fees the engine models (they stop
//     after Year 12). See schoolCostLines.

import { computeBudgetSummary, type BudgetExpense, type BudgetAnnualExpense, type BudgetIncome, type BudgetChildcare } from './budgetSummary'
import { computeCurrentNetWorth, type AssetRow, type DebtRow } from './netWorth'
import { findHelpDebt } from './members'
import { toMonthly } from './formatting'
import type { ProjectionInputs, WorkPhase, OneOff } from './projections'
import { presetScheduleFor } from './educationCosts'
import { SF_BASE, type FeeSchedule } from './schoolFees'
import type { LifePhaseOverlay } from './lifephases'
import type { HouseholdSuperInputs, ProjectionContext } from './super'

/** The budget's home-loan repayment line(s). */
export const isMortgageLine = (e: { cat: string; name: string }) => e.cat === 'Home' && /mortgage/i.test(e.name)

/**
 * Budget lines for school costs of the children the engine models (the
 * questionnaire's "School costs: Child 1 (age 7)" lines; Child 1 and 2 are
 * the two eldest, the engine's sfC1 and sfC2).
 */
export const isModelledSchoolLine = (e: { cat: string; name: string }) =>
  e.cat === 'Children' && /^School costs: Child [12] /.test(e.name)

export interface BaselineSource<E extends BudgetExpense> {
  expenses:       E[]
  annualExpenses: BudgetAnnualExpense[]
  income:         BudgetIncome
  childcare:      BudgetChildcare
  rentMonthly:    number | null
  person1Days:    number
  person2Days:    number
  partnerEnabled: boolean
  person1Name:    string
  person2Name:    string
  debts:          DebtRow[]
  assets:         AssetRow[]
  mortgage:       { balance: number } | null
}

export interface ProjectionBaseline {
  /** The budget's monthly spending less rent. The loan repayment and modelled school costs come out in buildProjectionInputs. */
  baseMonthlyExpenses:   number
  /** The budget's own monthly spending, for display ("spending today"). */
  budgetMonthlyExpenses: number
  /** Today's spending without the home loan and children's costs: the default retirement goal. */
  retirementMonthly:     number
  budgetMortgageMonthly: number
  /** School costs in the budget for the children the engine's school-fee model covers. */
  modelledSchoolMonthly: number
  person1HELPBalance:    number
  person2HELPBalance:    number
  mortBalance:           number
  cashOnHand:            number
  propValue:             number
  cryptoValue:           number
  investmentsValue:      number
  otherDebts:            number
  netWorthToday:         number
}

export function projectionBaseline<E extends BudgetExpense>(s: BaselineSource<E>): ProjectionBaseline {
  const budget = computeBudgetSummary({
    expenses: s.expenses, annualExpenses: s.annualExpenses, income: s.income, childcare: s.childcare,
    rentMonthly: s.rentMonthly, person1Days: s.person1Days, person2Days: s.person2Days, partnerEnabled: s.partnerEnabled,
  })
  const monthly = (list: E[]) => list.reduce((t, e) => t + toMonthly(e.amt, e.freq), 0)
  const budgetMortgageMonthly = monthly(s.expenses.filter(isMortgageLine))

  const { mortDebt, propValue, cryptoValue, cashOnHand, otherAssets, debtsOwed, netWorth } = computeCurrentNetWorth(s.debts, s.assets, s.mortgage)
  const person1HELPBalance = findHelpDebt(s.debts, s.person1Name)?.amt ?? 0
  const person2HELPBalance = s.partnerEnabled ? (findHelpDebt(s.debts, s.person2Name)?.amt ?? 0) : 0

  return {
    baseMonthlyExpenses:   Math.max(0, budget.monthlyExpenses - (s.rentMonthly ?? 0)),
    budgetMonthlyExpenses: budget.monthlyExpenses,
    retirementMonthly:     spendingInRetirement(budget, s.expenses),
    budgetMortgageMonthly,
    modelledSchoolMonthly: monthly(s.expenses.filter(isModelledSchoolLine)),
    person1HELPBalance, person2HELPBalance,
    mortBalance: mortDebt, cashOnHand, propValue, cryptoValue,
    investmentsValue: otherAssets,
    // HELP balances are repaid inside the engine; any other debt is held flat.
    otherDebts: Math.max(0, debtsOwed - person1HELPBalance - person2HELPBalance),
    netWorthToday: netWorth,
  }
}

export interface ProjectionSettingsLike {
  person1Growth: number; person2Growth: number
  expInflNear: number; expInfl: number; childcareInfl: number
  propGrowth: number; savingsRate: number; investReturn: number; projYears: number
  schoolFeesOn: boolean
  sfC1Start: number; sfC1ExitIdx: number; sfC2Start: number; sfC2ExitIdx: number; sfInfl: number
  sfPresetKey: string | null
  parentalLeaveEnabled: boolean
}

export interface RentSettingsLike {
  enabled: boolean; monthlyRent: number; annualIncreaseRate: number
  purchasePlanEnabled: boolean; targetPurchaseYear: number; targetPropertyValue: number
  depositPct: number; depositFromCash: number; depositFromInvestments: number
  newMortgageRate: number; newMortgageTermYrs: number
}

export type IncomeLike = Pick<BudgetIncome, 'taxMode' | 'person1FTE' | 'person2FTE' | 'person1MonthlyNet' | 'person2MonthlyNet'>

/** The school-fee schedule: the chosen preset, else the household's own levels, else the default. */
export function feeScheduleFor(presetKey: string | null, levels: { level: string; tuition: number; fixed: number }[]): FeeSchedule {
  const own = levels.length ? Object.fromEntries(levels.map(r => [r.level, { tuition: r.tuition, fixed: r.fixed }])) : SF_BASE
  return (presetKey && presetScheduleFor(presetKey)) || own
}

export interface ProjectionLive {
  income:         IncomeLike
  settings:       ProjectionSettingsLike
  person1Phases:  WorkPhase[]
  person2Phases:  WorkPhase[]
  oneoffs:        OneOff[]
  lifePhases:     LifePhaseOverlay[]
  sfSchedule:     FeeSchedule
  rent:           RentSettingsLike
  mortgage:       { rate: number; payment: number }
  currentYear:    number
}

export function buildProjectionInputs(b: ProjectionBaseline, l: ProjectionLive): ProjectionInputs {
  const s = l.settings
  // While a loan is modelled, the engine pays it (un-inflated, stopping at
  // payoff), so the budget's repayment line comes out of the inflating base.
  // With no recorded repayment, the budget line stands in for it.
  const modelsMortgage = !l.rent.enabled && b.mortBalance > 0
  const payment = l.mortgage.payment > 0 ? l.mortgage.payment : b.budgetMortgageMonthly
  const base = b.baseMonthlyExpenses
    - (modelsMortgage ? b.budgetMortgageMonthly : 0)
    - (s.schoolFeesOn ? b.modelledSchoolMonthly : 0)
  return {
    person1FTE: l.income.person1FTE, person2FTE: l.income.person2FTE, taxMode: l.income.taxMode,
    // HELP is modelled whenever a balance is recorded: repayments are compulsory.
    person1HasHELP: b.person1HELPBalance > 0, person1HELPBalance: b.person1HELPBalance,
    person2HasHELP: b.person2HELPBalance > 0, person2HELPBalance: b.person2HELPBalance,
    person1MonthlyNet: l.income.person1MonthlyNet, person2MonthlyNet: l.income.person2MonthlyNet,
    person1GrowthRate: s.person1Growth, person2GrowthRate: s.person2Growth,
    expInflNear: s.expInflNear, expInfl: s.expInfl, childcareInfl: s.childcareInfl,
    propGrowth: s.propGrowth, savingsRate: s.savingsRate, investReturn: s.investReturn,
    projYears: s.projYears,
    mortBalance: b.mortBalance, mortRate: l.mortgage.rate, mortPayment: payment,
    cashOnHand: b.cashOnHand, propValue: b.propValue, cryptoValue: b.cryptoValue,
    investmentsValue: b.investmentsValue, otherDebts: b.otherDebts,
    person1Phases: l.person1Phases, person2Phases: l.person2Phases,
    baseMonthlyExpenses: Math.max(0, base),
    oneoffs: l.oneoffs,
    parentalLeaveEnabled: s.parentalLeaveEnabled,
    schoolFeesOn: s.schoolFeesOn,
    sfC1Start: s.sfC1Start, sfC1ExitIdx: s.sfC1ExitIdx, sfC2Start: s.sfC2Start, sfC2ExitIdx: s.sfC2ExitIdx,
    sfInfl: s.sfInfl, sfSchedule: l.sfSchedule,
    lifePhases: l.lifePhases,
    currentYear: l.currentYear,
    rentMode: l.rent.enabled, monthlyRent: l.rent.monthlyRent, rentIncreaseRate: l.rent.annualIncreaseRate,
    purchasePlanEnabled: l.rent.purchasePlanEnabled, targetPurchaseYear: l.rent.targetPurchaseYear,
    targetPropertyValue: l.rent.targetPropertyValue, depositPct: l.rent.depositPct,
    depositFromCash: l.rent.depositFromCash, depositFromInvestments: l.rent.depositFromInvestments,
    newMortgageRate: l.rent.newMortgageRate, newMortgageTermYrs: l.rent.newMortgageTermYrs,
  }
}

// ── Super ────────────────────────────────────────────────────────────────────

/** Saved goals that are only ever placeholders (schema default, NAS seed). */
const PLACEHOLDER_RETIREMENT_INCOMES = [60_000, 80_000]

/**
 * Today's monthly spending without what stops before retirement: home-loan
 * repayments and the children's costs (childcare, school). The starting point
 * for a retirement income goal.
 */
export function spendingInRetirement<E extends BudgetExpense>(budget: { monthlyExpenses: number; catMonthly: Record<string, number> }, expenses: E[]): number {
  const loan = expenses.filter(isMortgageLine).reduce((t, e) => t + toMonthly(e.amt, e.freq), 0)
  return Math.max(0, budget.monthlyExpenses - loan - (budget.catMonthly['Children'] ?? 0))
}

/**
 * The household's retirement income goal (a year, today's dollars): what was
 * saved, unless it's still a placeholder, in which case today's spending in
 * retirement (spendingInRetirement) rounded to the nearest $1,000.
 */
export function retirementIncomeGoal(saved: number, retirementMonthly: number): number {
  return !saved || PLACEHOLDER_RETIREMENT_INCOMES.includes(saved)
    ? Math.round(retirementMonthly * 12 / 1000) * 1000
    : saved
}

export interface SuperSettingsLike {
  sgRate: number; investmentReturn: number; fundFeePercent: number; inflationRate: number
  desiredRetirementIncome: number
  person1Balance: number; person1RetirementAge: number; person1AdditionalContribs: number
  person2Balance: number; person2RetirementAge: number; person2AdditionalContribs: number
}

export function superInputsFor(
  sup: SuperSettingsLike, partnerEnabled: boolean, retirementMonthly: number,
  income: { person1Age: number; person2Age: number; person1FTE: number; person2FTE: number },
  growth: { person1Growth: number; person2Growth: number },
): { inputs: HouseholdSuperInputs; ctx: ProjectionContext } {
  return {
    inputs: {
      sgRate: sup.sgRate, investmentReturn: sup.investmentReturn, fundFeePercent: sup.fundFeePercent, inflationRate: sup.inflationRate,
      desiredRetirementIncome: retirementIncomeGoal(sup.desiredRetirementIncome, retirementMonthly),
      person1Balance: sup.person1Balance, person1RetirementAge: sup.person1RetirementAge, person1AdditionalContribs: sup.person1AdditionalContribs,
      partnerEnabled,
      person2Balance: sup.person2Balance, person2RetirementAge: sup.person2RetirementAge, person2AdditionalContribs: sup.person2AdditionalContribs,
    },
    ctx: {
      person1Age: income.person1Age, person1Salary: income.person1FTE, person1SalaryGrowth: growth.person1Growth / 100,
      person2Age: income.person2Age, person2Salary: income.person2FTE, person2SalaryGrowth: growth.person2Growth / 100,
    },
  }
}
