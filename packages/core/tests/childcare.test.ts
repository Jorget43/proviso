import { describe, it, expect } from 'vitest'
import { standardCcsRate, higherCcsRate, computeChildcare } from '../src/childcare'

describe('standardCcsRate (CCS taper FY2026-27)', () => {
  it('is 90% at/below the lower income threshold', () => {
    expect(standardCcsRate(50000)).toBe(90)
    expect(standardCcsRate(88520)).toBe(90)
  })
  it('drops 1 point per $5,000 over the threshold', () => {
    // floor((100000-88520)/5000) = 2 → 88
    expect(standardCcsRate(100000)).toBe(88)
  })
  it('is 0% at/above the upper threshold', () => {
    expect(standardCcsRate(538520)).toBe(0)
    expect(standardCcsRate(600000)).toBe(0)
  })
})

describe('higherCcsRate (younger children)', () => {
  it('is 95% up to $146,437', () => {
    expect(higherCcsRate(100000)).toBe(95)
    expect(higherCcsRate(146437)).toBe(95)
  })
  it('tapers 1 point per $3,000 down to 80%', () => {
    // floor((170000-146437)/3000) = 7 → 88
    expect(higherCcsRate(170000)).toBe(88)
    expect(higherCcsRate(200000)).toBe(80)
    expect(higherCcsRate(270000)).toBe(80)
  })
  it('tapers again from $270,727 down to 50%', () => {
    // floor((300000-270727)/3000) = 9 → 71
    expect(higherCcsRate(300000)).toBe(71)
    expect(higherCcsRate(365000)).toBe(50)
  })
  it('falls back to the standard rate at/above the higher-rate income cap', () => {
    expect(higherCcsRate(370727)).toBe(standardCcsRate(370727))
    expect(higherCcsRate(400000)).toBe(standardCcsRate(400000))
  })
  it('is never below the standard rate', () => {
    for (let inc = 0; inc < 600000; inc += 7919) expect(higherCcsRate(inc)).toBeGreaterThanOrEqual(standardCcsRate(inc))
  })
})

describe('computeChildcare', () => {
  it('nets out-of-pocket cost after subsidy for one child', () => {
    const r = computeChildcare({ costPerDay: 120, daysPerWeek: 3, numChildren: 1, familyIncome: 100000 })
    expect(r.standardRate).toBe(88)
    expect(r.grossWeekly).toBeCloseTo(360, 6)
    expect(r.subsidyWeekly).toBeCloseTo(316.8, 6)  // 360 × 88%
    expect(r.netWeekly).toBeCloseTo(43.2, 6)
    expect(r.netAnnual).toBeCloseTo(2246.4, 6)
    expect(r.capApplied).toBe(false)
  })

  it('flags when the daily fee exceeds the hourly cap', () => {
    const r = computeChildcare({ costPerDay: 200, daysPerWeek: 5, numChildren: 1, familyIncome: 50000 })
    expect(r.capApplied).toBe(true)
  })

  it('subsidises younger children at the higher rate', () => {
    const one = computeChildcare({ costPerDay: 120, daysPerWeek: 3, numChildren: 1, familyIncome: 100000 })
    const two = computeChildcare({ costPerDay: 120, daysPerWeek: 3, numChildren: 2, familyIncome: 100000 })
    // second child subsidised at 95% (higher) not 88% → its net is lower than the first's
    const secondChildNet = two.netWeekly - one.netWeekly
    expect(secondChildNet).toBeLessThan(one.netWeekly)
    expect(secondChildNet).toBeGreaterThanOrEqual(0)
  })
})
