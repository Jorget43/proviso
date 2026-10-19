import { describe, it, expect } from 'vitest'
import {
  mixVolatility, mixPath, planInputs, yearsToLastRetirement, normals, drawReturn, runOutlook, chanceWords, mainOf,
  GROWTH_PREMIUM, DEFAULT_GROWTH_PCT, DEFAULT_GLIDE_TARGET_PCT, type MixSettings,
} from '../src/uncertainty'
import type { LifeCourse } from '../src/projections'
import { makeProjectionInputs, FX_YEAR } from './fixtures/projections'

const flat: MixSettings = { growthPct: 70, glidePath: false, glideTargetPct: 50 }
const glide: MixSettings = { ...flat, glidePath: true }

// The fixture has every dial at 0 and nothing new invested (savings rate 0),
// so investments only grow by the return: invest × (1 + r) each year.
const simple = makeProjectionInputs({ investmentsValue: 100_000, investReturn: 5, projYears: 10, mortBalance: 0, mortPayment: 0 })

const lifeCourse: LifeCourse = {
  partnerEnabled: false, person1Age: 55, person2Age: 55, person1RetirementAge: 60, person2RetirementAge: 60,
  person1Super: 400_000, person2Super: 0, person1ExtraSuper: 0, person2ExtraSuper: 0,
  sgRate: 0.12, superReturn: 0.06, superFeePct: 0, retirementSpending: 40_000, drawdown: 'need', drawdownPct: 6,
}

describe('the investment mix', () => {
  it('swings more the more is in growth assets (about 14 / 11 / 8.5% a year at 90 / 70 / 50%)', () => {
    // √((g·16%)² + ((1−g)·4%)² + 2·g·(1−g)·0.1·16%·4%)
    expect(mixVolatility(90)).toBeCloseTo(0.1443, 3)
    expect(mixVolatility(70)).toBeCloseTo(0.1138, 3)
    expect(mixVolatility(50)).toBeCloseTo(0.0844, 3)
    expect(mixVolatility(0)).toBeCloseTo(0.04, 6)
    expect(DEFAULT_GROWTH_PCT).toBe(70)
    expect(DEFAULT_GLIDE_TARGET_PCT).toBe(50)
  })

  it('stays put without the glide path, and glides evenly to the target by retirement with it', () => {
    expect(mixPath(flat, 4, 2)).toEqual([70, 70, 70, 70])
    // 70 → 50 over 4 years: 65, 60, 55, 50, then 50.
    expect(mixPath(glide, 6, 4)).toEqual([65, 60, 55, 50, 50, 50])
  })

  it('runs the glide until the last adult retires', () => {
    expect(yearsToLastRetirement({ ...simple, lifeCourse })).toBe(5)
    expect(yearsToLastRetirement({ ...simple, lifeCourse: { ...lifeCourse, partnerEnabled: true, person2Age: 50, person2RetirementAge: 62 } })).toBe(12)
    expect(yearsToLastRetirement(simple)).toBe(10)   // no life course: the whole projection
  })

  it('the glide path lowers the expected return by the growth premium as the mix moves', () => {
    const p = planInputs({ ...simple, lifeCourse }, glide)
    // 20 points less growth by retirement (year 5): 20% × 3.5 = 0.7 points lower.
    expect(GROWTH_PREMIUM).toBe(3.5)
    expect(p.investReturnByYear![0]).toBeCloseTo(5 - 0.14, 10)
    expect(p.investReturnByYear![4]).toBeCloseTo(4.3, 10)
    expect(p.investReturnByYear![9]).toBeCloseTo(4.3, 10)
    expect(p.superReturnByYear![4]).toBeCloseTo(0.053, 10)
    // Off: the inputs are untouched, so the plan doesn't move.
    expect(planInputs(simple, flat)).toBe(simple)
  })
})

describe('random returns', () => {
  it('are the same every time (seeded), centred on 0 with a spread of 1', () => {
    const z = normals(42, 20_000)
    expect(normals(42, 5)).toEqual(z.slice(0, 5))
    const mean = z.reduce((t, v) => t + v, 0) / z.length
    const sd = Math.sqrt(z.reduce((t, v) => t + (v - mean) ** 2, 0) / z.length)
    expect(Math.abs(mean)).toBeLessThan(0.02)
    expect(sd).toBeCloseTo(1, 1)
  })

  it('a year’s return is the median at the middle draw, with the swing asked for', () => {
    expect(drawReturn(0.05, 0.12, 0)).toBeCloseTo(0.05, 12)
    const r = normals(7, 20_000).map(z => drawReturn(0.05, 0.12, z))
    const sorted = [...r].sort((a, b) => a - b)
    const mean = r.reduce((t, v) => t + v, 0) / r.length
    const sd = Math.sqrt(r.reduce((t, v) => t + (v - mean) ** 2, 0) / r.length)
    expect(sorted[10_000]).toBeCloseTo(0.05, 2)
    expect(sd).toBeCloseTo(0.12, 2)
    expect(Math.min(...r)).toBeGreaterThan(-1)   // can't lose more than everything
  })
})

describe('the outlook', () => {
  it('switched off, it is the plan alone, unchanged', () => {
    const o = runOutlook(simple, flat, false, FX_YEAR, null)
    expect(o.on).toBe(false)
    // 100,000 × 1.05^10
    expect(mainOf(o.plan).investArr[9]).toBe(162_889)
    expect(o.netWorth.low).toEqual(o.netWorth.high)
    expect(o.chanceLasts).toBeNull()
  })

  it('switched on, the band surrounds the plan, and the plan is its middle', () => {
    const o = runOutlook(simple, flat, true, FX_YEAR, null, 300)
    expect(o.on).toBe(true)
    expect(o.runs).toBe(300)
    const mid = o.endNetWorth.mid
    expect(o.endNetWorth.low).toBeLessThan(mid)
    expect(o.endNetWorth.high).toBeGreaterThan(mid)
    for (let y = 0; y < 10; y++) expect(o.netWorth.low[y]).toBeLessThanOrEqual(o.netWorth.high[y])
    // Only the investments swing (cash doesn't). Ten years of lognormal
    // returns at 11.4%: s ≈ 0.108 a year, 0.342 over ten, so the 10th to 90th
    // percentile of what 162,889 of investments becomes is about
    // ×e^(−1.28·0.342) = ×0.645 to ×e^(1.28·0.342) = ×1.55: a width of about
    // 0.9 × 162,889 ≈ 147,000.
    const width = o.endNetWorth.high - o.endNetWorth.low
    expect(width / 162_889).toBeGreaterThan(0.75)
    expect(width / 162_889).toBeLessThan(1.05)
    // Same household, same figures.
    expect(runOutlook(simple, flat, true, FX_YEAR, null, 300).endNetWorth).toEqual(o.endNetWorth)
  })

  it('more growth assets, wider band', () => {
    const narrow = runOutlook(simple, { ...flat, growthPct: 30 }, true, FX_YEAR, null, 300).endNetWorth
    const wide = runOutlook(simple, { ...flat, growthPct: 95 }, true, FX_YEAR, null, 300).endNetWorth
    expect(wide.high - wide.low).toBeGreaterThan(2 * (narrow.high - narrow.low))
  })

  it('gives the chance money lasts, and the age it runs short in the worst tenth', () => {
    // Retiring at 60 on 300,000 of super, spending 60,000 a year: the plan runs short at 74,
    // the worst tenth of runs sooner, and few runs last.
    const inputs = { ...simple, investmentsValue: 0, projYears: 40, lifeCourse: { ...lifeCourse, person1Super: 300_000, retirementSpending: 60_000 } }
    const o = runOutlook(inputs, flat, true, FX_YEAR, 55, 300)
    expect(o.shortAgeMid).toBe(74)
    expect(o.shortAgeLow!).toBeLessThan(74)
    expect(o.chanceLasts!).toBeLessThan(0.2)
  })

  it('shows sequence risk: the plan lasts, yet bad runs of years still run out', () => {
    // 400,000 of super, 40,000 a year: lasts on the plan's steady returns, not in every order of years.
    const o = runOutlook({ ...simple, investmentsValue: 0, projYears: 40, lifeCourse }, flat, true, FX_YEAR, 55, 300)
    expect(o.shortAgeMid).toBeNull()
    expect(o.chanceLasts!).toBeGreaterThan(0.4)
    expect(o.chanceLasts!).toBeLessThan(0.9)
    expect(o.shortAgeLow).not.toBeNull()
  })

  it('a household with plenty lasts in almost every run', () => {
    const inputs = { ...simple, investmentsValue: 0, projYears: 40, lifeCourse }
    // Plenty of super: it lasts in almost every run.
    const rich = runOutlook({ ...inputs, lifeCourse: { ...lifeCourse, person1Super: 3_000_000 } }, flat, true, FX_YEAR, 55, 300)
    expect(rich.chanceLasts!).toBeGreaterThan(0.95)
    expect(rich.shortAgeLow).toBeNull()
  })

  it('puts a chance into plain words', () => {
    expect([0.999, 0.94, 0.5, 0.06, 0.001].map(chanceWords)).toEqual(['almost all', 'about 9 in 10', 'about 5 in 10', 'about 1 in 10', 'almost none'])
  })

  it('is quick enough for a phone: 500 runs of a 60-year life well under a second here', () => {
    const inputs = { ...simple, projYears: 60, lifeCourse: { ...lifeCourse, person1Age: 35 } }
    const t = performance.now()
    runOutlook(inputs, glide, true, FX_YEAR, 35)
    expect(performance.now() - t).toBeLessThan(1000)
  })
})
