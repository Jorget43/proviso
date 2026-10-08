import { describe, it, expect } from 'vitest'
import { runProjections, type LifeCourse, type ProjectionInputs } from '../src/projections'
import { calcAfterTax } from '../src/tax'
import { PPL_TOTAL } from '../src/constants'
import { minimumDrawdownRate, yearsToAge, asDrawdownStrategy, superAccessible } from '../src/retirement'
import { makeProjectionInputs, FX_YEAR } from './fixtures/projections'

// The life course in runProjections: retirement, super inside the
// projection, and drawdown. Every dial is 0 (fixture), there's no home loan,
// and super earns nothing, so each figure below is worked by hand.
// Ages are those reached in each projected year: someone aged 64 in
// FX_YEAR (2026) is 65 in the first projected year, 2027.

function lifeCourse(o: Partial<LifeCourse> = {}): LifeCourse {
  return {
    partnerEnabled: false,
    person1Age: 40, person2Age: 40,
    person1RetirementAge: 67, person2RetirementAge: 67,
    person1Super: 0, person2Super: 0,
    person1ExtraSuper: 0, person2ExtraSuper: 0,
    sgRate: 0.12, superReturn: 0, superFeePct: 0,
    retirementSpending: 40_000,
    drawdown: 'need', drawdownPct: 6,
    ...o,
  }
}

const run = (lc: Partial<LifeCourse>, o: Partial<ProjectionInputs> = {}) =>
  runProjections(makeProjectionInputs({
    mortBalance: 0, mortPayment: 0, cashOnHand: 0, projYears: 4,
    lifeCourse: lifeCourse(lc), ...o,
  })).base

describe('life course — retirement rules', () => {
  it('minimum pension drawdown rates by age (ATO standard rates)', () => {
    expect([59, 64, 65, 74, 75, 80, 85, 90, 95, 101].map(minimumDrawdownRate))
      .toEqual([0.04, 0.04, 0.05, 0.05, 0.06, 0.07, 0.09, 0.11, 0.14, 0.14])
  })

  it('super is reachable when retired at 60+, or at 65 regardless', () => {
    expect(superAccessible(59, true)).toBe(false)
    expect(superAccessible(60, true)).toBe(true)
    expect(superAccessible(64, false)).toBe(false)
    expect(superAccessible(65, false)).toBe(true)
  })

  it('horizon runs until the younger adult reaches the age, at least 5 years', () => {
    expect(yearsToAge(95, 30, 35)).toBe(65)
    expect(yearsToAge(95, 40, null)).toBe(55)
    expect(yearsToAge(95, 92, null)).toBe(5)
  })

  it('unknown drawdown strategies (from a newer device) fall back to "need"', () => {
    expect(asDrawdownStrategy('fourPercent')).toBe('fourPercent')
    expect(asDrawdownStrategy('somethingNew')).toBe('need')
    expect(asDrawdownStrategy(null)).toBe('need')
  })
})

describe('life course — no life course given', () => {
  it('super is not modelled and nothing is flagged', () => {
    const r = runProjections(makeProjectionInputs()).base
    expect(r.superArr).toEqual([0, 0, 0, 0, 0])
    expect(r.retiredArr).toEqual([false, false, false, false, false])
    expect([r.person1RetireYr, r.person2RetireYr, r.shortfallYr, r.bridgeShortYr]).toEqual([null, null, null, null])
  })
})

describe('life course — working years', () => {
  // Both 40, $120k each. Person 1 salary-sacrifices $10,000.
  const r = run({ partnerEnabled: true, person1ExtraSuper: 10_000 }, { projYears: 1 })

  it('salary sacrifice comes out of pre-tax pay', () => {
    // Person 1 is taxed on 120,000 − 10,000 = 110,000; person 2 on 120,000 (= 91,080, tests/tax.test.ts).
    expect(r.person1Arr[0]).toBe(Math.round(calcAfterTax(110_000)))
    expect(r.person2Arr[0]).toBe(91_080)
  })

  it('super gets SG plus the sacrifice, less 15% contributions tax', () => {
    // Person 1: (120,000 × 12% + 10,000) × 0.85 = 24,400 × 0.85 = 20,740
    // Person 2:  120,000 × 12%           × 0.85 = 14,400 × 0.85 = 12,240
    expect(r.super1Arr[0]).toBe(20_740)
    expect(r.super2Arr[0]).toBe(12_240)
    expect(r.superArr[0]).toBe(32_980)
    expect(r.retiredArr[0]).toBe(false)
  })

  it('super is paid on Paid Parental Leave', () => {
    // Person 2 on leave in 2027: PPL_TOTAL × 12% × 0.85.
    const leave = run({ partnerEnabled: true }, {
      projYears: 1, person2Phases: [{ year: FX_YEAR + 1, days: 0 }],
    })
    expect(leave.super2Arr[0]).toBe(Math.round(PPL_TOTAL * 0.12 * 0.85))
  })

  it('a household without a partner ignores person 2’s pay', () => {
    expect(run({}, { projYears: 1 }).person2Arr[0]).toBe(0)
  })
})

describe('life course — spending switches when everyone has retired', () => {
  // Person 1 is 67 in 2027 (retired); person 2 is 61 then 62 (retires at 62).
  const r = run(
    { partnerEnabled: true, person1Age: 66, person2Age: 60, person2RetirementAge: 62, retirementSpending: 30_000 },
    { projYears: 2, cashOnHand: 100_000 },
  )

  it('pay stops at each person’s retirement age', () => {
    expect(r.person1Arr).toEqual([0, 0])
    expect(r.person2Arr).toEqual([91_080, 0])
    expect([r.person1RetireYr, r.person2RetireYr]).toEqual([2027, 2028])
  })

  it('budget spending ($5,000 a month) while one still works, then the retirement goal', () => {
    expect(r.expArr).toEqual([60_000, 30_000])
    expect(r.retiredArr).toEqual([false, true])
  })
})

describe('life course — spend what you need', () => {
  // Single, 65 in 2027 and retired, $100,000 in super, $50,000 cash, spends $40,000 a year.
  const r = run({ person1Age: 64, person1RetirementAge: 65, person1Super: 100_000 }, { cashOnHand: 50_000 })

  it('super pays at least the minimum; cash, then super, cover the rest', () => {
    // 2027: minimum 5% × 100,000 = 5,000; cash 50,000 − 35,000 = 15,000 left.
    // 2028: minimum 5% × 95,000 = 4,750; cash pays 15,000; super the other 20,250.
    // 2029: minimum 5% × 70,000 = 3,500; super pays the other 36,500.
    // 2030: minimum 5% × 30,000 = 1,500; super pays its last 28,500; 10,000 short.
    expect(r.superDrawArr).toEqual([5_000, 25_000, 40_000, 30_000])
    expect(r.superArr).toEqual([95_000, 70_000, 30_000, 0])
    expect(r.cashArr).toEqual([15_000, 0, 0, 0])
    expect(r.owedArr).toEqual([0, 0, 0, 10_000])
    expect(r.incArr).toEqual([5_000, 25_000, 40_000, 30_000])
    expect(r.expArr).toEqual([40_000, 40_000, 40_000, 40_000])
  })

  it('flags the year the money runs out; net worth leaves super out', () => {
    expect(r.shortfallYr).toBe(2030)
    expect(r.bridgeShortYr).toBeNull()
    // 2030: home 800,000 + crypto 10,000 − owed 10,000.
    expect(r.nwArr[3]).toBe(800_000)
  })
})

describe('life course — retiring before super can be reached (the bridge)', () => {
  // Single, retires at 55 in 2027 with $500,000 in super and nothing else.
  const r = run({ person1Age: 54, person1RetirementAge: 55, person1Super: 500_000 }, { projYears: 6 })

  it('ages 55–59: super is locked, so spending is carried as money owed', () => {
    expect(r.owedArr.slice(0, 5)).toEqual([40_000, 80_000, 120_000, 160_000, 200_000])
    expect(r.superArr.slice(0, 5)).toEqual([500_000, 500_000, 500_000, 500_000, 500_000])
    expect(r.bridgeShortYr).toBe(2027)
    expect(r.shortfallYr).toBeNull()
  })

  it('at 60, super pays the year’s spending and clears what is owed', () => {
    // Minimum 4% × 500,000 = 20,000; the other 20,000 of spending; plus the 200,000 owed.
    expect(r.superDrawArr[5]).toBe(240_000)
    expect(r.superArr[5]).toBe(260_000)
    expect(r.owedArr[5]).toBe(0)
    expect(r.incArr[5]).toBe(40_000)   // what was lived on; repaying the debt isn't income
  })
})

describe('life course — set drawdown amounts', () => {
  // Single, 60 in 2027 and retired, $1,000,000 in super, no inflation.
  const base = { person1Age: 59, person1RetirementAge: 60, person1Super: 1_000_000, retirementSpending: 30_000 }

  it('4% rule: 4% of the first-year balance, then the same (plus 0% inflation)', () => {
    // 2027: 40,000 (= the 4% minimum). 2028: minimum 4% × 960,000 = 38,400 < 40,000.
    const r = run({ ...base, drawdown: 'fourPercent' }, { projYears: 2 })
    expect(r.superDrawArr).toEqual([40_000, 40_000])
    expect(r.superArr).toEqual([960_000, 920_000])
  })

  it('percentage of balance: 6% of whatever is there', () => {
    // 6% × 1,000,000 = 60,000; 6% × 940,000 = 56,400.
    const r = run({ ...base, drawdown: 'percentOfBalance', drawdownPct: 6 }, { projYears: 2 })
    expect(r.superDrawArr).toEqual([60_000, 56_400])
    expect(r.superArr).toEqual([940_000, 883_600])
    // The extra over spending lands in cash: 30,000 then 26,400 more.
    expect(r.cashArr).toEqual([30_000, 56_400])
  })

  it('minimum only: a gap is not taken from super; it shows as money owed', () => {
    // 2027: minimum 40,000 against 50,000 of spending → 10,000 short.
    const r = run({ ...base, drawdown: 'minimum', retirementSpending: 50_000 }, { projYears: 1 })
    expect(r.superDrawArr).toEqual([40_000])
    expect(r.superArr).toEqual([960_000])
    expect(r.owedArr).toEqual([10_000])
    expect(r.shortfallYr).toBe(2027)
  })
})
