// Child Care Subsidy (CCS) engine — Services Australia FY2026-27 parameters
// (in effect from 6 July 2026).
//
// CCS is income-tested on COMBINED family income and paid as a percentage of the
// fee, up to an hourly rate cap. Families with more than one child aged 5 or
// under get a higher rate for the younger child(ren) ("higher CCS").
//
// Out-of-pocket childcare = (cost/day × days/week × children) − subsidy.
//
// Verify these against Services Australia each financial year (see lib/watchdog.ts):
//   https://www.servicesaustralia.gov.au/how-much-child-care-subsidy-you-can-get

export const CCS_PARAMS_FY = 2027 // FY26-27

// Standard rate taper.
const CCS_LOWER_INCOME = 88_520   // ≤ this → 90%
const CCS_MAX_RATE     = 90       // percent
const CCS_TAPER_STEP   = 5_000    // −1 percentage point per $5,000 over the lower threshold
const CCS_ZERO_INCOME  = 538_520  // ≥ this → 0%

// Higher CCS for the second and younger children aged 5 or under: its own
// income test with two tapers (1 point per $3,000), not a fixed uplift.
//   ≤ 146,437 → 95%; tapers to 80% by 191,437; 80% to 270,727;
//   tapers to 50% by 360,727; 50% below 370,727; then the standard rate.
const CCS_HIGHER_MAX         = 95
const CCS_HIGHER_BAND1_START = 146_437
const CCS_HIGHER_MID         = 80
const CCS_HIGHER_BAND2_START = 270_727
const CCS_HIGHER_MIN         = 50
const CCS_HIGHER_TAPER_STEP  = 3_000
const CCS_HIGHER_INCOME_CAP  = 370_727  // higher rate only available below this combined income

// Hourly rate cap for Centre Based Day Care, children below school age
// (FY26-27). Fees above the cap are not subsidised. A standard daily session
// is assumed to be CCS_SESSION_HOURS long.
export const CCS_HOURLY_CAP    = 15.19
export const CCS_SESSION_HOURS = 10

/** Standard CCS percentage for a given combined family income (0–90). */
export function standardCcsRate(familyIncome: number): number {
  if (familyIncome <= CCS_LOWER_INCOME) return CCS_MAX_RATE
  if (familyIncome >= CCS_ZERO_INCOME)  return 0
  const steps = Math.floor((familyIncome - CCS_LOWER_INCOME) / CCS_TAPER_STEP)
  return Math.max(0, CCS_MAX_RATE - steps)
}

/** Higher CCS percentage for younger children (0–95), or the standard rate if ineligible. */
export function higherCcsRate(familyIncome: number): number {
  const standard = standardCcsRate(familyIncome)
  if (familyIncome >= CCS_HIGHER_INCOME_CAP) return standard
  const steps = (start: number) => Math.floor((familyIncome - start) / CCS_HIGHER_TAPER_STEP)
  let higher: number
  if (familyIncome <= CCS_HIGHER_BAND1_START)      higher = CCS_HIGHER_MAX
  else if (familyIncome < CCS_HIGHER_BAND2_START)  higher = Math.max(CCS_HIGHER_MID, CCS_HIGHER_MAX - steps(CCS_HIGHER_BAND1_START))
  else                                             higher = Math.max(CCS_HIGHER_MIN, CCS_HIGHER_MID - steps(CCS_HIGHER_BAND2_START))
  return Math.max(standard, higher)
}

export interface ChildcareInputs {
  costPerDay:   number // gross fee per child per day, before subsidy
  daysPerWeek:  number // days each child attends
  numChildren:  number // children in care
  familyIncome: number // combined gross family income
}

export interface ChildcareResult {
  standardRate:  number // percent, eldest child
  higherRate:    number // percent, younger children (== standard if ineligible)
  grossWeekly:   number
  subsidyWeekly: number
  netWeekly:     number
  netMonthly:    number
  netAnnual:     number
  capApplied:    boolean // true when the daily fee exceeds the subsidised cap
}

/**
 * Net (out-of-pocket) childcare cost after CCS.
 *
 * The eldest child in care is subsidised at the standard rate; younger children
 * at the higher rate (when the family qualifies). Subsidy is calculated on the
 * fee capped at CCS_HOURLY_CAP × CCS_SESSION_HOURS per day.
 */
export function computeChildcare(inp: ChildcareInputs): ChildcareResult {
  const { costPerDay, daysPerWeek, numChildren, familyIncome } = inp
  const standardRate = standardCcsRate(familyIncome)
  const higherRate   = higherCcsRate(familyIncome)
  const dailyCap     = CCS_HOURLY_CAP * CCS_SESSION_HOURS
  const subsidisedDayFee = Math.min(costPerDay, dailyCap)
  const capApplied   = costPerDay > dailyCap

  let grossWeekly = 0
  let netWeekly   = 0
  for (let i = 0; i < Math.max(0, numChildren); i++) {
    const rate = i === 0 ? standardRate : higherRate
    const gross = costPerDay * daysPerWeek
    const subsidy = subsidisedDayFee * daysPerWeek * (rate / 100)
    grossWeekly += gross
    netWeekly   += Math.max(0, gross - subsidy)
  }

  const subsidyWeekly = grossWeekly - netWeekly
  return {
    standardRate,
    higherRate,
    grossWeekly,
    subsidyWeekly,
    netWeekly,
    netMonthly: netWeekly * 52 / 12,
    netAnnual:  netWeekly * 52,
    capApplied,
  }
}
