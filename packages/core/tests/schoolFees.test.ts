import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { schoolFeesForYear, SF_BASE, SF_SIBLING_DISC, SF_CML_BASE } from '../src/schoolFees'

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
    // Kindergarten: tuition 5000 + fixed 500 = 5500; cml 350; mult=1 (yr===currentYear, inflRate=0)
    const r = schoolFeesForYear(2026, 2026, 13, 2099, 13, 0)
    expect(r.c1).toBe(5500)
    expect(r.c2).toBe(0)
    expect(r.sibSaving).toBe(0)
    expect(r.cml).toBe(350)
    expect(r.total).toBe(5850)
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
    // yr=2028: c1Idx = 2028-2026 = 2 → "Year 1" (9000 tuition, 1000 fixed)
    //          c2Idx = 2028-2028 = 0 → "Kindergarten" (5000 tuition, 500 fixed)
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
    // Kindergarten 5500 * 1.05^1 = 5775
    const r = schoolFeesForYear(2027, 2027, 13, 2099, 13, 5)
    expect(r.c1).toBeCloseTo(5500 * 1.05, 6)
    expect(r.cml).toBeCloseTo(350 * 1.05, 6)
  })

  it('mult is 1 in the current wall-clock year regardless of rate', () => {
    const r = schoolFeesForYear(2026, 2026, 13, 2099, 13, 25)
    expect(r.c1).toBe(5500)
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

// ── School fees v2 ───────────────────────────────────────────────────────────
import { schoolFeesYear, LEGACY_FEE_RULES, schoolFeesForYear as legacyYear, SF_BASE as BASE, type SchoolKid, type FeeSchedule as Schedule } from '../src/schoolFees'
import { schoolKidsFor, schoolFeeRules, type ProjectionLive } from '../src/future'
import { EDUCATION_PRESETS as PRESETS } from '../src/educationCosts'

// Every level $10,000 tuition + $1,000 fixed, so each figure can be checked by eye.
const FLAT: Schedule = Object.fromEntries(Object.keys(BASE).map(l => [l, { tuition: 10_000, fixed: 1_000 }]))
const kid = (start: number, over: Partial<SchoolKid> = {}): SchoolKid =>
  ({ start, exitIdx: 13, primary: FLAT, secondary: FLAT, primaryChoice: 'custom', secondaryChoice: 'custom', ...over })

describe('schoolFeesYear (v2)', () => {
  it('matches the rules before v2 for two children', () => {
    for (const yr of [2027, 2030, 2036, 2044]) {
      const old = legacyYear(yr, 2027, 13, 2030, 13, 5)
      const now = schoolFeesYear(yr, [kid(2027, { primary: BASE, secondary: BASE }), kid(2030, { primary: BASE, secondary: BASE })], LEGACY_FEE_RULES, 5)
      expect(now.total).toBeCloseTo(old.total, 6)
      expect(now.perChild[0]).toBeCloseTo(old.c1, 6)
      expect(now.perChild[1]).toBeCloseTo(old.c2, 6)
      expect(now.sibSaving).toBeCloseTo(old.sibSaving, 6)
    }
  })

  it('gives each younger child at school their own discount, an entry fee when they start, and one family fee', () => {
    // In 2030, no inflation: A in level 5, B in level 3, C starting (level 0).
    // A 11,000; B 11,000 − 10% of 10,000 = 10,000; C 11,000 − 20% of 10,000 + 1,000 entry = 10,000; family 500.
    const r = schoolFeesYear(2030, [kid(2025), kid(2027), kid(2030)], { siblingPct: [10, 20, 50], familyFee: 500, entryFee: 1_000 }, 0, 2030)
    expect(r.perChild).toEqual([11_000, 10_000, 10_000])
    expect(r.sibSaving).toBe(3_000)
    expect(r.family).toBe(500)
    expect(r.total).toBe(31_500)
    // A fourth child at school gets the 4th-or-later rate: 11,000 − 50% of 10,000 = 6,000.
    expect(schoolFeesYear(2030, [kid(2025), kid(2026), kid(2027), kid(2028)], { siblingPct: [10, 20, 50], familyFee: 0, entryFee: 0 }, 0, 2030).perChild[3]).toBe(6_000)
  })

  it('a stage that isn’t modelled costs nothing and doesn’t count as a sibling at school', () => {
    // A is in primary but it's not modelled; B is then the first child at school: no discount.
    const r = schoolFeesYear(2030, [kid(2027, { primary: null, primaryChoice: 'none' }), kid(2028)], { siblingPct: [10, 10, 10], familyFee: 0, entryFee: 0 }, 0, 2030)
    expect(r.perChild).toEqual([0, 11_000])
    // No one at school: no family fee either.
    expect(schoolFeesYear(2050, [kid(2027)], { siblingPct: [0, 0, 0], familyFee: 500, entryFee: 0 }, 0, 2050).total).toBe(0)
  })

  it('charges an entry fee again only when secondary is a different school', () => {
    const rules = { siblingPct: [0, 0, 0] as [number, number, number], familyFee: 0, entryFee: 2_000 }
    // Level 8 (Year 7) in 2030.
    expect(schoolFeesYear(2030, [kid(2022, { primaryChoice: 'government', secondaryChoice: 'independent' })], rules, 0, 2030).total).toBe(13_000)
    expect(schoolFeesYear(2030, [kid(2022, { primaryChoice: 'independent', secondaryChoice: 'independent' })], rules, 0, 2030).total).toBe(11_000)
  })

  it('stops after the last level they attend', () => {
    expect(schoolFeesYear(2030, [kid(2022, { exitIdx: 7 })], LEGACY_FEE_RULES, 0, 2030).total).toBe(0)
  })
})

describe('schoolKidsFor', () => {
  const settings = {
    person1Growth: 3, person2Growth: 3, expInflNear: 3, expInfl: 2.5, childcareInfl: 6, propGrowth: 3.5,
    savingsRate: 50, investReturn: 5, projYears: 20, schoolFeesOn: true,
    sfC1Start: 2030, sfC1ExitIdx: 13, sfC2Start: 2033, sfC2ExitIdx: 13, sfInfl: 5, sfPresetKey: 'vic|catholic' as string | null, parentalLeaveEnabled: false,
  }
  const live = (over: Partial<ProjectionLive>): ProjectionLive => ({
    income: { taxMode: true, person1FTE: 0, person2FTE: 0, person1MonthlyNet: 0, person2MonthlyNet: 0 },
    settings, person1Phases: [], person2Phases: [], oneoffs: [], lifePhases: [], sfSchedule: PRESETS['vic|catholic'].schedule,
    rent: { enabled: false, monthlyRent: 0, annualIncreaseRate: 5, purchasePlanEnabled: false, targetPurchaseYear: 2031, targetPropertyValue: 0, depositPct: 20, depositFromCash: 0, depositFromInvestments: 0, newMortgageRate: 6, newMortgageTermYrs: 30 },
    mortgage: { rate: 6, payment: 0 }, currentYear: 2026, ...over,
  })

  it('takes each stage from the child’s choice, else the household’s school type, at the household’s location', () => {
    const own = { ...FLAT }
    const kids = schoolKidsFor(live({ ownSchedule: own, children: [
      { name: null, birthYear: 2016, birthMonth: null, primarySchool: null, secondarySchool: 'independent' },
      { name: null, birthYear: 2019, birthMonth: null, primarySchool: 'custom', secondarySchool: 'none' },
      { name: null, birthYear: 2008, birthMonth: null },   // 18: finished school
    ] }))
    expect(kids).toHaveLength(2)
    expect(kids[0]).toMatchObject({ start: 2020, primaryChoice: 'catholic', secondaryChoice: 'independent' })
    expect(kids[0].primary).toBe(PRESETS['vic|catholic'].schedule)
    expect(kids[0].secondary).toBe(PRESETS['vic|independent'].schedule)
    expect(kids[1]).toMatchObject({ start: 2023, primaryChoice: 'custom', secondaryChoice: 'none', secondary: null })
    expect(kids[1].primary).toBe(own)
  })

  it('without a school type, uses where the household lives', () => {
    const kids = schoolKidsFor(live({ settings: { ...settings, sfPresetKey: null }, state: 'nsw', regional: true,
      children: [{ name: null, birthYear: 2016, birthMonth: null, secondarySchool: 'government' }] }))
    expect(kids[0].secondary).toBe(PRESETS['nsw_r|government'].schedule)
  })

  it('reads settings from before v2 as the old rules', () => {
    expect(schoolFeeRules(settings)).toEqual(LEGACY_FEE_RULES)
    expect(schoolFeeRules({ ...settings, sfSib2Pct: 10, sfSib3Pct: 20, sfSib4Pct: 100, sfFamilyFee: 0, sfEntryFee: 500 }))
      .toEqual({ siblingPct: [10, 20, 100], familyFee: 0, entryFee: 500 })
  })
})
