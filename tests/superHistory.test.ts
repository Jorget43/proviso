import { describe, it, expect } from 'vitest'
import {
  legislativeCap,
  currentFinancialYearEnding,
  computeCarryForward,
  CARRY_FORWARD_TSB_LIMIT,
  type SuperHistoryRow,
} from '@/lib/superHistory'

describe('legislativeCap — table lookups and extrapolation', () => {
  it('returns the legislated value at known table entries', () => {
    expect(legislativeCap(2019)).toBe(25_000)
    expect(legislativeCap(2026)).toBe(30_000)
    // FY2026-27 — verified against ato.gov.au 2026-08-11; this is the value
    // super.ts's private estimate could never reproduce (it would have
    // rounded 30000×1.035=31050 to 30000, not 32500).
    expect(legislativeCap(2027)).toBe(32_500)
  })

  it('falls back to the earliest legislated value below the table range', () => {
    expect(legislativeCap(2018)).toBe(25_000)
    expect(legislativeCap(2000)).toBe(25_000)
  })

  it('extrapolates beyond the table from the LAST legislated entry, floored to the nearest $2,500', () => {
    // From FY2027 ($32,500): floor(32500×1.035^n / 2500) × 2500
    expect(legislativeCap(2028)).toBe(32_500) // n=1: 33637.5 → floor 13 → 32500
    expect(legislativeCap(2030)).toBe(35_000) // n=3: 36033.3 → floor 14 → 35000
    expect(legislativeCap(2032)).toBe(37_500) // n=5: 38599.8 → floor 15 → 37500
  })
})

describe('currentFinancialYearEnding — 30 June / 1 July boundary', () => {
  it('is this calendar year on 30 June', () => {
    expect(currentFinancialYearEnding(new Date(2026, 5, 30))).toBe(2026) // month index 5 = June
  })

  it('rolls over to next calendar year on 1 July', () => {
    expect(currentFinancialYearEnding(new Date(2026, 6, 1))).toBe(2027) // month index 6 = July
  })
})

describe('computeCarryForward — 5-year window edge', () => {
  const now = new Date(2026, 7, 11) // 11 Aug 2026 → currentFyEnding = 2027, window = [2022, 2026]

  function row(fy: number, cap: number, utilised: number, tsb = 0): SuperHistoryRow {
    return { member: 'Test', financialYearEnding: fy, concessionalCap: cap, concessionalUtilised: utilised, totalSuperBalance: tsb }
  }

  it('includes Y-5 (2022) but excludes Y-6 (2021)', () => {
    const rows = [
      row(2021, 25_000, 0, 100_000), // Y-6 — outside the window
      row(2022, 27_500, 0, 100_000), // Y-5 — inside
      row(2026, 30_000, 30_000, 100_000), // Y-1 — inside, fully utilised (0 unused)
    ]
    const cf = computeCarryForward('Test', rows, now)
    const fyIncluded = cf.years.filter(y => y.withinWindow).map(y => y.financialYearEnding)
    expect(fyIncluded).toContain(2022)
    expect(fyIncluded).not.toContain(2021)
    // Only 2022's full $27,500 is unused and within the window (2026 fully utilised)
    expect(cf.availableCarryForward).toBe(27_500)
  })

  it('currentCap comes from legislativeCap(currentFyEnding), not a row', () => {
    const cf = computeCarryForward('Test', [row(2026, 30_000, 0, 0)], now)
    expect(cf.currentFyEnding).toBe(2027)
    expect(cf.currentCap).toBe(32_500)
  })
})

describe('computeCarryForward — TSB eligibility gate (strict <)', () => {
  const now = new Date(2026, 7, 11)

  function row(fy: number, tsb: number): SuperHistoryRow {
    return { member: 'Test', financialYearEnding: fy, concessionalCap: 30_000, concessionalUtilised: 20_000, totalSuperBalance: tsb }
  }

  it('is ineligible at exactly the $500,000 threshold', () => {
    const cf = computeCarryForward('Test', [row(2026, CARRY_FORWARD_TSB_LIMIT)], now)
    expect(cf.eligible).toBe(false)
  })

  it('is eligible one dollar below the threshold', () => {
    const cf = computeCarryForward('Test', [row(2026, CARRY_FORWARD_TSB_LIMIT - 1)], now)
    expect(cf.eligible).toBe(true)
    expect(cf.maxConcessionalThisYear).toBe(cf.currentCap + cf.availableCarryForward)
  })

  it('is ineligible (not merely unknown) when the prior-year (Y-1) row is missing entirely', () => {
    // Rows present for Y-2..Y-5 but not Y-1 (2026) — a real gap a user might leave.
    const rows = [2022, 2023, 2024, 2025].map(fy => row(fy, 100_000))
    const cf = computeCarryForward('Test', rows, now)
    expect(cf.priorTotalSuperBalance).toBeNull()
    expect(cf.eligible).toBe(false)
    // The accrued carry-forward is still reported even though it's unusable this year.
    expect(cf.availableCarryForward).toBeGreaterThan(0)
    expect(cf.maxConcessionalThisYear).toBe(cf.currentCap) // bonus NOT applied
  })
})
