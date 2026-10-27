// Readings of a projection's year-by-year output that the Future charts share
// (Money in & out, Home), so the NAS and the app count the same things.

/** Repayments above this share of household income before tax are the usual "mortgage stress" line. */
export const MORTGAGE_STRESS_PCT = 30

interface MoneyRun {
  person1Arr:    number[]
  person2Arr:    number[]
  expArr:        number[]
  superDrawArr?: number[]
  investIncArr?: number[]
}

/** Money in each year: take-home pay, anything taken from super to live on, and interest less tax on investment income. */
export function moneyIn(r: Omit<MoneyRun, 'expArr'>, showPerson2: boolean): number[] {
  return r.person1Arr.map((v, i) => v + (showPerson2 ? r.person2Arr[i] ?? 0 : 0) + (r.superDrawArr?.[i] ?? 0) + (r.investIncArr?.[i] ?? 0))
}

/** Money in less everything that goes out, each year (negative = short). */
export function leftOver(r: MoneyRun, showPerson2: boolean): number[] {
  return moneyIn(r, showPerson2).map((v, i) => v - (r.expArr[i] ?? 0))
}

/**
 * How many of the years (from the first) someone still works. Once everyone
 * has retired, living off super and savings is the plan, not a shortfall.
 */
export function workingYears(r: { retiredArr: boolean[]; deficitArr: number[] }): number {
  const retired = r.retiredArr.indexOf(true)
  return retired >= 0 ? retired : r.deficitArr.length
}

/** Indexes of working years when more goes out than comes in. */
export function tightWorkingYears(r: { retiredArr: boolean[]; deficitArr: number[] }): number[] {
  return r.deficitArr.slice(0, workingYears(r)).flatMap((v, i) => (v < 0 ? [i] : []))
}

/** Indexes of years when home-loan repayments are above the stress line. */
export function stressYears(r: { mortStressArr: number[] }): number[] {
  return r.mortStressArr.flatMap((v, i) => (v > MORTGAGE_STRESS_PCT ? [i] : []))
}
