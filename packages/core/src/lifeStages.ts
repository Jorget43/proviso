// Life stages: costs that follow people's ages instead of calendar years
// (plan item 10, Phase 44). The projection starts from today's budget, which
// already reflects the household as it is now: children at their current
// ages, the adults' working costs, childcare. So the engine adds only the
// CHANGE from today each year:
//   - each child's cost moves to their age band's (and to 0 once they leave
//     home); a child born later adds their whole cost from birth,
//   - childcare stops for each child in care as they start school,
//   - working costs (commuting) follow each adult's days at work, and stop
//     when they retire,
//   - from 85, retirement spending eases (ASFA).
// Amounts are monthly, in MODEL_BASE_YEAR dollars; the engine inflates them.
//
// Sources:
//   - Children: AMP.NATSEM Income and Wealth Report 33, "Cost of Kids" (May
//     2013), Table 1: weekly cost of a child for a middle-income couple, Dec
//     2012 dollars: 0–4 $133, 5–9 $198, 10–14 $228, 15–17 $414, 18–24 $678.
//     × 1.442 to June quarter 2026 prices (ABS CPI: Dec 2012 = 102.0 on
//     2011–12 = 100; June 2025 = 141.7; +3.8% to June 2026).
//     × 0.783: without childcare (6.6%), education (5.5%) and housing (9.6%)
//     — the shares in the report's Table 6 (middle income, lifetime) — which
//     the projection models separately (childcare, school fees, rent/loan).
//   - Metro vs regional: ABS Household Expenditure Survey 2015–16, spending
//     other than housing: capital cities $1,231 a week, rest of state $985
//     (0.80). With about two thirds of families in capitals, NATSEM's national
//     figure × 1.07 (metro) or × 0.856 (regional).
//   - Working costs: Real Insurance, The Real Commute Report 2025 (Aug 2025,
//     2,000 people): $19.10 a day out of pocket, including $4.80 tolls. Regional
//     leaves out the tolls. 5 days × 48 weeks, +3.8% to 2026 prices.
//   - From 85: ASFA Retirement Standard, detailed budgets, June quarter 2025
//     (home owners, comfortable): couple $1,442.88 a week at 65–84, $1,343.58
//     at 85+ (−7%: more health and home help, less driving, travel and eating
//     out); single $1,020.87 → $969.30 (−5%).
//
// Re-check these once a year with the other figures (lib/watchdog.ts).

import { SCHOOL_START_AGE } from './people'

export interface ChildStage {
  key:     string
  label:   string
  /** First age in the band. */
  from:    number
  /** Last age in the band. */
  to:      number
  /** A month, MODEL_BASE_YEAR dollars. */
  metro:   number
  regional: number
}

const WEEKS_PER_MONTH = 52 / 12
const NATSEM_2012 = { b0: 133, b5: 198, b10: 228, b15: 414, b18: 678 }
const CPI_DEC2012_TO_2026 = 1.442
const WITHOUT_MODELLED = 0.783
const METRO = 1.07
const REGIONAL = 0.856

const monthly = (weekly2012: number, area: number) =>
  Math.round(weekly2012 * CPI_DEC2012_TO_2026 * WITHOUT_MODELLED * area * WEEKS_PER_MONTH / 5) * 5

const stage = (key: string, label: string, from: number, to: number, w: number): ChildStage =>
  ({ key, label, from, to, metro: monthly(w, METRO), regional: monthly(w, REGIONAL) })

export const CHILD_STAGES: ChildStage[] = [
  stage('baby',    'Baby and toddler: nappies, formula, food, clothes, gear', 0, 4, NATSEM_2012.b0),
  stage('primary', 'Primary school age: food, clothes, activities',          5, 9, NATSEM_2012.b5),
  stage('tween',   'Ages 10–14: food, clothes, activities, a phone',        10, 14, NATSEM_2012.b10),
  stage('teen',    'Teenager: food, transport, activities, phone',          15, 17, NATSEM_2012.b15),
  stage('adult',   'Grown up, still at home: food, transport, study costs', 18, 99, NATSEM_2012.b18),
]

/** Children leave home in the year they turn this, unless the household says otherwise. */
export const DEFAULT_LEAVE_HOME_AGE = 18
export const MAX_LEAVE_HOME_AGE = 25

/** What a child costs a month at an age (MODEL_BASE_YEAR dollars): 0 before birth and once they've left home. */
export function childStageMonthly(age: number, regional: boolean, leaveHomeAge: number = DEFAULT_LEAVE_HOME_AGE): number {
  if (age < 0 || age >= leaveHomeAge) return 0
  const s = CHILD_STAGES.find(x => age >= x.from && age <= x.to)
  return s ? (regional ? s.regional : s.metro) : 0
}

/** Working costs (commuting) a month for someone working 5 days a week. */
export const WORK_COST_MONTHLY = {
  metro:    Math.round(19.10 * 1.038 * 5 * 48 / 12 / 5) * 5,
  regional: Math.round((19.10 - 4.80) * 1.038 * 5 * 48 / 12 / 5) * 5,
}

/** From this age (the younger adult's), retirement spending eases. */
export const LATE_RETIREMENT_AGE = 85
export const LATE_RETIREMENT_FACTOR = { couple: 1343.58 / 1442.88, single: 969.30 / 1020.87 }

export interface LifeStageFacts {
  /** Children's birth years (any order); future years for children planned. */
  childBirthYears: number[]
  leaveHomeAge:    number
  regional:        boolean
  /** Today's childcare after the subsidy, a month (what the budget has), and how many children it's for. */
  childcareMonthly:  number
  childcareChildren: number
  /** Days a week each adult works this year (0 if not working). */
  workDaysToday:   [number, number]
}

/** The children in childcare today: the youngest not yet at school, as many as the childcare settings say. */
export function childrenInCare(birthYears: number[], count: number, year: number): number[] {
  return birthYears
    .filter(b => year - b >= 0 && year - b < SCHOOL_START_AGE)
    .sort((a, b) => b - a)
    .slice(0, Math.max(0, count))
}

/**
 * The change in yearly spending from today's budget, in MODEL_BASE_YEAR
 * dollars, for a projected year.
 *
 * allRetired: once everyone has retired, spending is the retirement goal,
 * which already leaves out children's costs and working costs; children
 * still at home then add their whole cost, and working costs don't apply.
 */
export function lifeStageYear(f: LifeStageFacts, p: {
  currentYear: number
  year:        number
  workDays:    [number, number]
  allRetired:  boolean
}): { children: number; childcare: number; work: number } {
  const { currentYear: cy, year: yr } = p
  let children = 0
  for (const b of f.childBirthYears) {
    const then = childStageMonthly(yr - b, f.regional, f.leaveHomeAge)
    const now  = p.allRetired ? 0 : childStageMonthly(cy - b, f.regional, f.leaveHomeAge)
    children += (then - now) * 12
  }

  // Childcare in the budget stops for each child as they start school.
  let childcare = 0
  const inCare = childrenInCare(f.childBirthYears, f.childcareChildren, cy)
  if (f.childcareMonthly > 0 && inCare.length > 0 && !p.allRetired) {
    const atSchool = inCare.filter(b => yr - b >= SCHOOL_START_AGE).length
    if (atSchool > 0) childcare = -f.childcareMonthly / inCare.length * 12 * atSchool
  }

  let work = 0
  if (!p.allRetired) {
    const full = (f.regional ? WORK_COST_MONTHLY.regional : WORK_COST_MONTHLY.metro) * 12
    for (const k of [0, 1] as const) work += full * (p.workDays[k] - f.workDaysToday[k]) / 5
  }
  return { children, childcare, work }
}
