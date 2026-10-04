import { describe, it, expect } from 'vitest'
import { lifePhaseCostForYear, type LifePhase } from '@/lib/lifephases'

// lifePhaseCostForYear has no Date dependency — the inflation anchor is a
// hardcoded literal (2026) inside the function, not the wall clock, so these
// tests need no clock freezing. They exist to prove lib/constants.ts's
// MODEL_BASE_YEAR refactor (Phase 15) is a byte-identical no-op: MODEL_BASE_YEAR
// is set to 2026, the same value this file hardcodes today.

function phase(overrides: Partial<LifePhase> = {}): LifePhase {
  return {
    id: 1,
    name: 'Test phase',
    type: 'recurring',
    monthlyAmt: 100,
    startYear: 2026,
    endYear: 2030,
    cat: 'Fun',
    enabled: true,
    ...overrides,
  }
}

describe('lifePhaseCostForYear — activation window', () => {
  it('is zero before startYear', () => {
    expect(lifePhaseCostForYear(2025, [phase({ startYear: 2026, endYear: 2030 })], 0)).toBe(0)
  })

  it('is zero after endYear', () => {
    expect(lifePhaseCostForYear(2031, [phase({ startYear: 2026, endYear: 2030 })], 0)).toBe(0)
  })

  it('is included on the boundary years (inclusive range)', () => {
    const phases = [phase({ startYear: 2026, endYear: 2030, monthlyAmt: 100 })]
    // mult=1 at inflRate=0; recurring → monthlyAmt * 12
    expect(lifePhaseCostForYear(2026, phases, 0)).toBe(1200)
    expect(lifePhaseCostForYear(2030, phases, 0)).toBe(1200)
  })

  it('excludes a disabled phase regardless of year', () => {
    const phases = [phase({ enabled: false, startYear: 2020, endYear: 2100 })]
    expect(lifePhaseCostForYear(2026, phases, 0)).toBe(0)
  })
})

describe('lifePhaseCostForYear — recurring vs oneoff vs phaseout', () => {
  it('recurring: monthlyAmt × 12 × mult', () => {
    // 100 * 12 * 1 (mult=1 at inflRate=0)
    expect(lifePhaseCostForYear(2026, [phase({ type: 'recurring', monthlyAmt: 100 })], 0)).toBe(1200)
  })

  it('oneoff: monthlyAmt × mult — NOT multiplied by 12', () => {
    // 8000 * 1 (mult=1 at inflRate=0), unlike the recurring case
    expect(lifePhaseCostForYear(2026, [phase({ type: 'oneoff', monthlyAmt: 8000 })], 0)).toBe(8000)
  })

  it('phaseout: same ×12×mult formula as recurring — negative amounts subtract', () => {
    // -800 * 12 * 1 = -9600
    expect(lifePhaseCostForYear(2026, [phase({ type: 'phaseout', monthlyAmt: -800 })], 0)).toBe(-9600)
  })

  it('sums multiple active phases', () => {
    const phases = [
      phase({ id: 1, type: 'recurring', monthlyAmt: 100 }),
      phase({ id: 2, type: 'oneoff', monthlyAmt: 8000 }),
      phase({ id: 3, type: 'phaseout', monthlyAmt: -800 }),
    ]
    // 1200 + 8000 - 9600 = -400
    expect(lifePhaseCostForYear(2026, phases, 0)).toBe(-400)
  })
})

describe('lifePhaseCostForYear — inflation anchor (hardcoded 2026)', () => {
  it('applies (1+rate/100)^(yr-2026) to recurring amounts', () => {
    // 100 * 12 * 1.10^2 = 1200 * 1.21 = 1452
    expect(lifePhaseCostForYear(2028, [phase({ monthlyAmt: 100 })], 10)).toBeCloseTo(1452, 6)
  })

  it('mult is 1 at the anchor year itself, regardless of rate', () => {
    expect(lifePhaseCostForYear(2026, [phase({ monthlyAmt: 100 })], 25)).toBe(1200)
  })
})

describe('lifePhaseCostForYear — childcare-specific inflation rate', () => {
  it('applies childcareInflRate when cat=Children AND name matches daycare/childcare/school care', () => {
    const daycare = phase({ name: 'Daycare — Child 2', cat: 'Children', monthlyAmt: 100 })
    // childcare rate 20% over 2 years: 1200 * 1.2^2 = 1728
    expect(lifePhaseCostForYear(2028, [daycare], /* inflRate */ 5, /* childcareInflRate */ 20)).toBeCloseTo(1728, 6)
  })

  it('is case-insensitive and matches "childcare" and "school care" too', () => {
    const a = phase({ name: 'CHILDCARE top-up', cat: 'Children', monthlyAmt: 100 })
    const b = phase({ name: 'Before/after school care', cat: 'Children', monthlyAmt: 100 })
    expect(lifePhaseCostForYear(2028, [a], 5, 20)).toBeCloseTo(1728, 6)
    expect(lifePhaseCostForYear(2028, [b], 5, 20)).toBeCloseTo(1728, 6)
  })

  it('falls back to the general rate for Children-cat phases that do not name-match', () => {
    const clothing = phase({ name: 'Kids clothing — growing children', cat: 'Children', monthlyAmt: 100 })
    // general rate 5% over 2 years: 1200 * 1.05^2 = 1323
    expect(lifePhaseCostForYear(2028, [clothing], 5, 20)).toBeCloseTo(1323, 6)
  })

  it('falls back to the general rate for non-Children categories even if named "daycare"', () => {
    const notKids = phase({ name: 'Home daycare renovation', cat: 'Home', monthlyAmt: 100 })
    expect(lifePhaseCostForYear(2028, [notKids], 5, 20)).toBeCloseTo(1323, 6)
  })

  it('childcareInflRate defaults to inflRate when omitted', () => {
    const daycare = phase({ name: 'Daycare', cat: 'Children', monthlyAmt: 100 })
    expect(lifePhaseCostForYear(2028, [daycare], 5)).toBeCloseTo(1323, 6)
  })
})
