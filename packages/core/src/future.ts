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
import { workDaysForYear, type ProjectionInputs, type WorkPhase, type OneOff } from './projections'
import { presetScheduleFor } from './educationCosts'
import { SF_BASE, LEGACY_FEE_RULES, asSchoolChoice, type FeeSchedule, type SchoolChoice, type SchoolKid, type SchoolFeeRules } from './schoolFees'
import { locationKey, type StateKey } from './starter'
import type { LifePhaseOverlay } from './lifephases'
import type { HouseholdSuperInputs, ProjectionContext } from './super'
import { asDrawdownStrategy, yearsToAge, DEFAULT_HORIZON_AGE } from './retirement'
import { schoolChildren, type ChildLike } from './people'
import { DEFAULT_LEAVE_HOME_AGE } from './lifeStages'
import { DEFAULT_DIVIDEND_YIELD, DEFAULT_FRANKED_PCT, DEFAULT_CASH_RATE, DEFAULT_PERSON1_SHARE } from './investmentIncome'

/** The budget's home-loan repayment line(s). */
export const isMortgageLine = (e: { cat: string; name: string }) => e.cat === 'Home' && /mortgage/i.test(e.name)

/**
 * Budget lines for children's school costs (the questionnaire's
 * "School costs: Child 1 (age 7)" lines). The engine models every child's
 * fees since school fees v2, so all of them come out of the base.
 */
export const isModelledSchoolLine = (e: { cat: string; name: string }) =>
  e.cat === 'Children' && /^School costs: Child \d+ /.test(e.name)

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
  /** Childcare in the budget, after the subsidy, a month; and how many children it's for (0 when off). */
  childcareMonthly:      number
  childcareChildren:     number
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
    childcareMonthly:      budget.childcareNet ?? 0,
    childcareChildren:     s.childcare.enabled ? s.childcare.numChildren : 0,
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
  /** With a life course, the projection runs until the younger adult reaches this age (projYears is ignored). */
  horizonAge?: number
  /** Months of spending kept as cash before investing (schema v5). */
  cashBufferMonths?: number
  /** % of the surplus above the buffer spent on fun (schema v5). */
  funPct?: number
  /** Costs that follow ages (schema v6); on unless switched off. */
  lifeStagesOn?: boolean
  /** Children leave home in the year they turn this (schema v6). */
  childLeavesHomeAge?: number
  /** School fee rules (schema v8): % off tuition for the 2nd, 3rd and 4th+ child at school, a yearly family fee, an entry fee per school. */
  sfSib2Pct?:   number
  sfSib3Pct?:   number
  sfSib4Pct?:   number
  sfFamilyFee?: number
  sfEntryFee?:  number
  /** Points either side of the expected returns for the range shown (schema v9; ranges.ts). Not read since v10. */
  returnSpread?: number
  /** Monte Carlo range (schema v10; uncertainty.ts): on/off (null: follow returnSpread > 0), the growth mix and the glide path. */
  showRange?:      boolean | null
  growthPct?:      number
  glidePath?:      boolean
  glideTargetPct?: number
  /** Income from savings and investments (schema v11; investmentIncome.ts). */
  dividendYield?:      number
  frankedPct?:         number
  cashRate?:           number
  person1InvestShare?: number
}

export interface RentSettingsLike {
  enabled: boolean; monthlyRent: number; annualIncreaseRate: number
  purchasePlanEnabled: boolean; targetPurchaseYear: number; targetPropertyValue: number
  depositPct: number; depositFromCash: number; depositFromInvestments: number
  newMortgageRate: number; newMortgageTermYrs: number
  /** Stamp duty and buying costs, % of the price (schema v4). */
  stampDutyPct?: number
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
  /** People, retirement and super. Without it the projection runs as before Phase 40 (pay never stops). */
  life?:          LifeLive
  /**
   * The household's children (schema v3). When there are any, the school-fee
   * years follow their birth years instead of the stored start years, and a
   * single child is charged as one.
   */
  children?:      ChildLike[]
  /** Lives outside a capital city (schema v6): lower typical costs. */
  regional?:      boolean
  /** The household's state (schema v6), for typical school fees when the school type has no location yet. */
  state?:         string | null
  /** The household's own school-fee table ("Custom"); defaults to sfSchedule. */
  ownSchedule?:   FeeSchedule
}

/** The household's school-fee rules; settings from before v8 read as the old 15% and $350. */
export function schoolFeeRules(s: ProjectionSettingsLike): SchoolFeeRules {
  const d = LEGACY_FEE_RULES
  return {
    siblingPct: [s.sfSib2Pct ?? d.siblingPct[0], s.sfSib3Pct ?? d.siblingPct[1], s.sfSib4Pct ?? d.siblingPct[2]],
    familyFee: s.sfFamilyFee ?? d.familyFee, entryFee: s.sfEntryFee ?? d.entryFee,
  }
}

/**
 * Every child's school years for the engine (school fees v2). Each stage's
 * school is the child's own choice, else the household's school type. A type
 * uses the typical fees where the household lives; "custom" its own table.
 * Without child records, the two children set by start year, as before.
 */
export function schoolKidsFor(l: ProjectionLive): SchoolKid[] {
  const s = l.settings
  const [presetLoc, presetType] = s.sfPresetKey?.split('|') ?? []
  const loc = presetLoc ?? (l.state ? locationKey(l.state as StateKey, l.regional ?? false) : 'vic')
  const own = l.ownSchedule ?? l.sfSchedule
  const householdChoice: SchoolChoice = asSchoolChoice(presetType) ?? 'custom'
  const scheduleFor = (c: SchoolChoice): FeeSchedule | null =>
    c === 'none' ? null : c === 'custom' ? own : presetScheduleFor(`${loc}|${c}`) ?? own
  const kids = l.children?.length ? schoolChildren(l.children, l.currentYear) : []
  if (!kids.length) {
    // The household's default schedule, which may be a preset at another location.
    const legacy = (start: number, exitIdx: number): SchoolKid => ({ start, exitIdx, primary: l.sfSchedule, secondary: l.sfSchedule, primaryChoice: householdChoice, secondaryChoice: householdChoice })
    return l.children?.length ? [] : [legacy(s.sfC1Start, s.sfC1ExitIdx), legacy(s.sfC2Start, s.sfC2ExitIdx)]
  }
  return kids.map(({ child, start }, i) => {
    const primaryChoice = asSchoolChoice(child.primarySchool) ?? householdChoice
    const secondaryChoice = asSchoolChoice(child.secondarySchool) ?? householdChoice
    // The household's own default (no choice made) keeps the schedule exactly as before v2.
    const stage = (c: SchoolChoice, own: string | null | undefined) => (asSchoolChoice(own) ? scheduleFor(c) : l.sfSchedule)
    return {
      start,
      // "Exits after" from before v2 still applies to the two eldest.
      exitIdx: i === 0 ? s.sfC1ExitIdx : i === 1 ? s.sfC2ExitIdx : 13,
      primary: stage(primaryChoice, child.primarySchool), secondary: stage(secondaryChoice, child.secondarySchool),
      primaryChoice, secondaryChoice,
    }
  })
}

export interface LifeLive {
  partnerEnabled: boolean
  person1Age:     number
  person2Age:     number
  super:          SuperSettingsLike
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
  const life = l.life
  const sup  = life?.super
  const schoolKids = schoolKidsFor(l)
  return {
    person1FTE: l.income.person1FTE, person2FTE: l.income.person2FTE, taxMode: l.income.taxMode,
    // HELP is modelled whenever a balance is recorded: repayments are compulsory.
    person1HasHELP: b.person1HELPBalance > 0, person1HELPBalance: b.person1HELPBalance,
    person2HasHELP: b.person2HELPBalance > 0, person2HELPBalance: b.person2HELPBalance,
    person1MonthlyNet: l.income.person1MonthlyNet, person2MonthlyNet: l.income.person2MonthlyNet,
    person1GrowthRate: s.person1Growth, person2GrowthRate: s.person2Growth,
    expInflNear: s.expInflNear, expInfl: s.expInfl, childcareInfl: s.childcareInfl,
    propGrowth: s.propGrowth, savingsRate: s.savingsRate, investReturn: s.investReturn,
    cashBufferMonths: s.cashBufferMonths ?? 0, funPct: s.funPct ?? 0,
    projYears: life
      ? yearsToAge(s.horizonAge ?? DEFAULT_HORIZON_AGE, life.person1Age, life.partnerEnabled ? life.person2Age : null)
      : s.projYears,
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
    schoolKids, sfRules: schoolFeeRules(s),
    lifePhases: l.lifePhases,
    currentYear: l.currentYear,
    rentMode: l.rent.enabled, monthlyRent: l.rent.monthlyRent, rentIncreaseRate: l.rent.annualIncreaseRate,
    purchasePlanEnabled: l.rent.purchasePlanEnabled, targetPurchaseYear: l.rent.targetPurchaseYear,
    targetPropertyValue: l.rent.targetPropertyValue, depositPct: l.rent.depositPct,
    depositFromCash: l.rent.depositFromCash, depositFromInvestments: l.rent.depositFromInvestments,
    newMortgageRate: l.rent.newMortgageRate, newMortgageTermYrs: l.rent.newMortgageTermYrs,
    stampDutyPct: l.rent.stampDutyPct ?? 0,
    investIncome: {
      dividendYield: s.dividendYield ?? DEFAULT_DIVIDEND_YIELD, frankedPct: s.frankedPct ?? DEFAULT_FRANKED_PCT,
      cashRate: s.cashRate ?? DEFAULT_CASH_RATE, person1Share: s.person1InvestShare ?? DEFAULT_PERSON1_SHARE,
    },
    // Costs that follow ages need the people's ages, so only with a life course.
    lifeStages: life && sup && s.lifeStagesOn !== false ? {
      childBirthYears: (l.children ?? []).map(c => c.birthYear),
      leaveHomeAge: s.childLeavesHomeAge ?? DEFAULT_LEAVE_HOME_AGE,
      regional: l.regional ?? false,
      childcareMonthly: b.childcareMonthly ?? 0,
      childcareChildren: b.childcareChildren ?? 0,
      workDaysToday: [
        life.person1Age >= sup.person1RetirementAge ? 0 : workDaysForYear(l.person1Phases, l.currentYear),
        !life.partnerEnabled || life.person2Age >= sup.person2RetirementAge ? 0 : workDaysForYear(l.person2Phases, l.currentYear),
      ],
    } : undefined,
    lifeCourse: life && sup ? {
      partnerEnabled: life.partnerEnabled,
      person1Age: life.person1Age, person2Age: life.person2Age,
      person1RetirementAge: sup.person1RetirementAge, person2RetirementAge: sup.person2RetirementAge,
      person1Super: sup.person1Balance, person2Super: sup.person2Balance,
      person1ExtraSuper: sup.person1AdditionalContribs, person2ExtraSuper: sup.person2AdditionalContribs,
      sgRate: sup.sgRate, superReturn: sup.investmentReturn, superFeePct: sup.fundFeePercent,
      // The goal counts all spending; the engine models rent itself (it stops at a purchase).
      retirementSpending: Math.max(0, retirementIncomeGoal(sup.desiredRetirementIncome, b.retirementMonthly)
        - (l.rent.enabled ? l.rent.monthlyRent * 12 : 0)),
      drawdown: asDrawdownStrategy(sup.drawdownStrategy), drawdownPct: sup.drawdownPct ?? 5,
    } : undefined,
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
  drawdownStrategy?: string | null; drawdownPct?: number
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
