import { describe, it, expect } from 'vitest'
import { standardCcsRate, higherCcsRate, computeChildcare } from '@/lib/childcare'

describe('standardCcsRate (CCS taper 2024-25)', () => {
  it('is 90% at/below the lower income threshold', () => {
    expect(standardCcsRate(50000)).toBe(90)
    expect(standardCcsRate(83280)).toBe(90)
  })
  it('drops 1 point per $5,000 over the threshold', () => {
    // floor((100000-83280)/5000) = 3 → 87
    expect(standardCcsRate(100000)).toBe(87)
  })
  it('is 0% at/above the upper threshold', () => {
    expect(standardCcsRate(533280)).toBe(0)
    expect(standardCcsRate(600000)).toBe(0)
  })
})

describe('higherCcsRate (younger children)', () => {
  it('adds 30 points (capped at 95) below the higher-rate income cap', () => {
    expect(higherCcsRate(100000)).toBe(95) // min(95, 87+30)
  })
  it('falls back to the standard rate above the higher-rate income cap', () => {
    // 400000 ≥ 362408 → returns standard rate
    expect(higherCcsRate(400000)).toBe(standardCcsRate(400000))
  })
})

describe('computeChildcare', () => {
  it('nets out-of-pocket cost after subsidy for one child', () => {
    const r = computeChildcare({ costPerDay: 120, daysPerWeek: 3, numChildren: 1, familyIncome: 100000 })
    expect(r.standardRate).toBe(87)
    expect(r.grossWeekly).toBeCloseTo(360, 6)
    expect(r.subsidyWeekly).toBeCloseTo(313.2, 6)
    expect(r.netWeekly).toBeCloseTo(46.8, 6)
    expect(r.netAnnual).toBeCloseTo(2433.6, 6)
    expect(r.capApplied).toBe(false)
  })

  it('flags when the daily fee exceeds the hourly cap', () => {
    const r = computeChildcare({ costPerDay: 200, daysPerWeek: 5, numChildren: 1, familyIncome: 50000 })
    expect(r.capApplied).toBe(true)
  })

  it('subsidises younger children at the higher rate', () => {
    const one = computeChildcare({ costPerDay: 120, daysPerWeek: 3, numChildren: 1, familyIncome: 100000 })
    const two = computeChildcare({ costPerDay: 120, daysPerWeek: 3, numChildren: 2, familyIncome: 100000 })
    // second child subsidised at 95% (higher) not 87% → its net is lower than the first's
    const secondChildNet = two.netWeekly - one.netWeekly
    expect(secondChildNet).toBeLessThan(one.netWeekly)
    expect(secondChildNet).toBeGreaterThanOrEqual(0)
  })
})
