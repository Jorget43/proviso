// Retirement rules used by the life-course projection (projections.ts).
//
// Government figures — re-check each 1 July (CLAUDE.md, July recalibration):
//
// Preservation age: 60 for everyone born after 30 June 1964 (ATO, "Access
// your super", SIS Regulations 1994 reg 6.01). Every adult the app models
// today was born after that date, so 60 applies throughout.
//
// Unrestricted access: at 65 super can be withdrawn even while still working
// (ATO, "Conditions of release").
//
// Minimum annual payments from an account-based pension, as a share of the
// balance on 1 July (ATO, "Minimum annual payments for super income streams";
// SIS Regulations 1994 Schedule 7, standard rates — the temporary 50%
// reduction ended 30 June 2023).

export const PRESERVATION_AGE = 60
export const UNRESTRICTED_ACCESS_AGE = 65

const MINIMUM_DRAWDOWN: [fromAge: number, rate: number][] = [
  [95, 0.14], [90, 0.11], [85, 0.09], [80, 0.07], [75, 0.06], [65, 0.05], [0, 0.04],
]

/** The legislated minimum share of an account-based pension paid out in a year, at `age`. */
export function minimumDrawdownRate(age: number): number {
  return MINIMUM_DRAWDOWN.find(([from]) => age >= from)![1]
}

/** Super can be taken out: retired and past preservation age, or 65 and over. */
export function superAccessible(age: number, retired: boolean): boolean {
  return age >= UNRESTRICTED_ACCESS_AGE || (retired && age >= PRESERVATION_AGE)
}

/**
 * How retirement is paid for, once someone's super is in pension phase.
 *  - need:             spending is met from cash, then investments outside
 *                      super, then super. Super pays at least the legal minimum.
 *  - fourPercent:      super pays 4% of its balance in the first pension year,
 *                      then that amount plus inflation.
 *  - percentOfBalance: super pays a fixed share of whatever's there each year.
 *  - minimum:          super pays the legal minimum only.
 * Under the last three, super pays only its set amount; any gap comes from
 * cash and investments, then shows as money owed.
 */
export type DrawdownStrategy = 'need' | 'fourPercent' | 'percentOfBalance' | 'minimum'
export const DRAWDOWN_STRATEGIES: DrawdownStrategy[] = ['need', 'fourPercent', 'percentOfBalance', 'minimum']

/** Unknown values (from a newer device) fall back to the default. */
export function asDrawdownStrategy(v: string | null | undefined): DrawdownStrategy {
  return (DRAWDOWN_STRATEGIES as string[]).includes(v ?? '') ? v as DrawdownStrategy : 'need'
}

/** Default horizon: the projection runs until the younger adult turns this age. */
export const DEFAULT_HORIZON_AGE = 95

/** Years to project so the younger adult reaches `horizonAge` (at least 5). */
export function yearsToAge(horizonAge: number, person1Age: number, person2Age: number | null): number {
  const youngest = person2Age === null ? person1Age : Math.min(person1Age, person2Age)
  return Math.max(5, horizonAge - youngest)
}
