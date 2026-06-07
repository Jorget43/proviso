// Super concessional cap carry-forward (Phase 2B)
//
// The concessional cap can be carried forward for up to 5 prior financial
// years. Unused cap *accrues* each year you don't use the full cap, regardless
// of balance. You may only *use* carried-forward amounts in a year where your
// total super balance (TSB) at 30 June of the prior year was under $500,000.
// Unused amounts expire after 5 years.

export const CARRY_FORWARD_TSB_LIMIT = 500_000
export const CARRY_FORWARD_YEARS = 5
// Carry-forward began 1 July 2018, so FY18-19 (ending 2019) is the first
// year unused cap could start accruing.
export const CARRY_FORWARD_START_FY = 2019

// Legislative concessional caps by financial-year-ending. Beyond the known
// range we fall back to the latest legislated value.
export const LEGISLATIVE_CONCESSIONAL_CAP: Record<number, number> = {
  2019: 25_000, 2020: 25_000, 2021: 25_000,
  2022: 27_500, 2023: 27_500, 2024: 27_500,
  2025: 30_000, 2026: 30_000,
}

export function legislativeCap(financialYearEnding: number): number {
  const known = LEGISLATIVE_CONCESSIONAL_CAP[financialYearEnding]
  if (known) return known
  // Below the known range → earliest; above → latest.
  if (financialYearEnding < 2019) return 25_000
  return 30_000
}

// Australian financial year ends 30 June. Returns the FY-ending year for `now`.
export function currentFinancialYearEnding(now: Date = new Date()): number {
  const month = now.getMonth() + 1
  return month >= 7 ? now.getFullYear() + 1 : now.getFullYear()
}

export interface SuperHistoryRow {
  member:               string
  financialYearEnding:  number
  concessionalCap:      number
  concessionalUtilised: number
  totalSuperBalance:    number
}

export interface CarryForwardYear {
  financialYearEnding: number
  cap:                 number
  utilised:            number
  unused:              number  // max(0, cap − utilised)
  withinWindow:        boolean // one of the up-to-5 prior years
}

export interface CarryForwardResult {
  member:                 string
  currentFyEnding:        number
  currentCap:             number
  // Unused cap from the up-to-5 prior years (accrues regardless of TSB)
  availableCarryForward:  number
  // Eligible to use it this FY? TSB at 30 June of the prior FY < $500k
  eligible:               boolean
  priorTotalSuperBalance: number | null // null when the prior-year record is missing
  // What you could contribute concessionally this FY (cap + usable carry-forward)
  maxConcessionalThisYear: number
  years:                  CarryForwardYear[]
}

// Compute carry-forward for one member from their history rows.
export function computeCarryForward(
  member: string,
  rows: SuperHistoryRow[],
  now: Date = new Date(),
): CarryForwardResult {
  const currentFyEnding = currentFinancialYearEnding(now)
  const currentCap = legislativeCap(currentFyEnding)

  // Prior years that count toward carry-forward: [Y−5, Y−1].
  const windowStart = currentFyEnding - CARRY_FORWARD_YEARS
  const windowEnd = currentFyEnding - 1

  const byFy = new Map(rows.map(r => [r.financialYearEnding, r]))

  const years: CarryForwardYear[] = rows
    .filter(r => r.financialYearEnding < currentFyEnding)
    .sort((a, b) => b.financialYearEnding - a.financialYearEnding)
    .map(r => {
      const withinWindow = r.financialYearEnding >= windowStart && r.financialYearEnding <= windowEnd
      return {
        financialYearEnding: r.financialYearEnding,
        cap:                 r.concessionalCap,
        utilised:            r.concessionalUtilised,
        unused:              Math.max(0, r.concessionalCap - r.concessionalUtilised),
        withinWindow,
      }
    })

  const availableCarryForward = years
    .filter(y => y.withinWindow)
    .reduce((sum, y) => sum + y.unused, 0)

  // Eligibility is tested on the prior-year (Y−1) 30 June balance.
  const priorRow = byFy.get(windowEnd) ?? null
  const priorTotalSuperBalance = priorRow ? priorRow.totalSuperBalance : null
  const eligible = priorTotalSuperBalance !== null && priorTotalSuperBalance < CARRY_FORWARD_TSB_LIMIT

  const maxConcessionalThisYear = currentCap + (eligible ? availableCarryForward : 0)

  return {
    member,
    currentFyEnding,
    currentCap,
    availableCarryForward,
    eligible,
    priorTotalSuperBalance,
    maxConcessionalThisYear,
    years,
  }
}
