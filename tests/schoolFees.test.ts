import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { schoolFeesForYear, SF_BASE, SF_SIBLING_DISC, SF_CML_BASE } from '@/lib/schoolFees'

// schoolFeesForYear currently anchors its inflation multiplier to
// `new Date().getFullYear()` (lib/schoolFees.ts:49) rather than a fixed
// data-vintage year. We freeze the clock at "today" (2026-08-11, the day
// this suite was written) so these characterization tests describe current
// behaviour precisely. Phase 15 replaces the wall-clock read with an
// injectable `baseYear` defaulting to `MODEL_BASE_YEAR` (2026) — since today's
// wall-clock year IS 2026, every assertion below must remain byte-identical
// after that change. The genuinely clock-dependent regression test (proving
// the fix removes drift) is added alongside that change, not here.

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-11'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('schoolFeesForYear — activation windows', () => {
  it('returns all zeros when neither child is active', () => {
    const r = schoolFeesForYear(2026, 2030, 13, 2032, 13, 0)
    expect(r).toEqual({ total: 0, c1: 0, c2: 0, sibSaving: 0, cml: 0 })
  })

  it('is active for C1 only in its start year (Kindergarten, index 0)', () => {
    // Kindergarten: tuition 6000 + fixed 600 = 6600; cml 350; mult=1 (yr===currentYear, inflRate=0)
    const r = schoolFeesForYear(2026, 2026, 13, 2099, 13, 0)
    expect(r.c1).toBe(6600)
    expect(r.c2).toBe(0)
    expect(r.sibSaving).toBe(0)
    expect(r.cml).toBe(350)
    expect(r.total).toBe(6950)
  })

  it('exits when c1ExitIdx is passed (truncation)', () => {
    // c1Start=2026, c1ExitIdx=2 → active for idx 0,1,2 (2026-2028), inactive at idx 3 (2029)
    expect(schoolFeesForYear(2028, 2026, 2, 2099, 13, 0).c1).toBeGreaterThan(0)
    expect(schoolFeesForYear(2029, 2026, 2, 2099, 13, 0).c1).toBe(0)
  })

  it('exits when the schedule runs out of levels (idx >= levels.length)', () => {
    // SF_BASE has 14 levels (idx 0-13). idx 14 has no level to index into.
    expect(schoolFeesForYear(2040, 2026, 13, 2099, 13, 0).c1).toBe(0)
  })
})

describe('schoolFeesForYear — sibling discount', () => {
  it('applies SF_SIBLING_DISC to C2 tuition only while C1 is also active', () => {
    // yr=2028: c1Idx = 2028-2026 = 2 → "Class 1" (10000 tuition, 800 fixed)
    //          c2Idx = 2028-2028 = 0 → "Kindergarten" (6000 tuition, 600 fixed)
    const r = schoolFeesForYear(2028, 2026, 13, 2028, 13, 0)
    const c1Level = Object.values(SF_BASE)[2]
    const c2Level = Object.values(SF_BASE)[0]
    const disc = c2Level.tuition * SF_SIBLING_DISC
    expect(r.sibSaving).toBeCloseTo(disc, 6)
    expect(r.c1).toBeCloseTo(c1Level.tuition + c1Level.fixed, 6)
    expect(r.c2).toBeCloseTo(c2Level.tuition + c2Level.fixed - disc, 6)
    expect(r.total).toBeCloseTo(r.c1 + r.c2 + SF_CML_BASE, 6)
  })

  it('does not discount C2 when C1 is not active', () => {
    // C1 already exited (c1ExitIdx=0 → only active at idx 0, i.e. 2026)
    const r = schoolFeesForYear(2028, 2026, 0, 2028, 13, 0)
    expect(r.sibSaving).toBe(0)
  })
})

describe('schoolFeesForYear — CML', () => {
  it('is charged whenever either child is active, once per family', () => {
    const c1Only = schoolFeesForYear(2026, 2026, 13, 2099, 13, 0)
    expect(c1Only.cml).toBe(SF_CML_BASE)
  })
})

describe('schoolFeesForYear — inflation (frozen at 2026-08-11, i.e. currentYear=2026)', () => {
  it('applies (1+inflRate/100)^(yr-2026) at 5% inflation', () => {
    // Kindergarten 6600 * 1.05^1 = 6930
    const r = schoolFeesForYear(2027, 2027, 13, 2099, 13, 5)
    expect(r.c1).toBeCloseTo(6600 * 1.05, 6)
    expect(r.cml).toBeCloseTo(350 * 1.05, 6)
  })

  it('mult is 1 in the current wall-clock year regardless of rate', () => {
    const r = schoolFeesForYear(2026, 2026, 13, 2099, 13, 25)
    expect(r.c1).toBe(6600)
  })
})

describe('schoolFeesForYear — wall-clock independence (Phase 15 anchor fix)', () => {
  // Proves the fee schedule's inflation multiplier is anchored to
  // MODEL_BASE_YEAR (a data-vintage constant), not to whatever year the
  // simulation happens to run in. Before Phase 15, schoolFeesForYear read
  // `new Date().getFullYear()` directly — this exact assertion would have
  // failed for any two dates in different calendar years.
  it('produces the same result regardless of which year the code runs in', () => {
    vi.setSystemTime(new Date('2026-08-11'))
    const a = schoolFeesForYear(2035, 2027, 13, 2029, 13, 5)
    vi.setSystemTime(new Date('2031-03-01'))
    const b = schoolFeesForYear(2035, 2027, 13, 2029, 13, 5)
    expect(b).toEqual(a)
  })
})

describe('schoolFeesForYear — custom schedule override', () => {
  it('uses the supplied schedule instead of SF_BASE', () => {
    const custom = { 'Level A': { tuition: 1000, fixed: 0 } }
    const r = schoolFeesForYear(2026, 2026, 0, 2099, 0, 0, custom)
    expect(r.c1).toBe(1000)
  })
})
