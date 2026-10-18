import { describe, it, expect } from 'vitest'
import { runRange, shiftReturns, summariseRange, mainOf, DEFAULT_RETURN_SPREAD } from '../src/ranges'
import type { LifeCourse } from '../src/projections'
import { makeProjectionInputs, FX_YEAR } from './fixtures/projections'

// The fixture has every dial at 0, including the investment return, and
// nothing new is invested (savings rate 0), so investments only grow by the
// return: invest × (1 + r) each year.
const inputs = makeProjectionInputs({ investmentsValue: 100_000, projYears: 3, mortBalance: 0, mortPayment: 0 })

const lifeCourse: LifeCourse = {
  partnerEnabled: false, person1Age: 40, person2Age: 40, person1RetirementAge: 67, person2RetirementAge: 67,
  person1Super: 100_000, person2Super: 0, person1ExtraSuper: 0, person2ExtraSuper: 0,
  sgRate: 0.12, superReturn: 0.07, superFeePct: 0, retirementSpending: 40_000, drawdown: 'need', drawdownPct: 6,
}

describe('ranges of returns', () => {
  it('moves every investment return by the spread, super’s as a decimal', () => {
    const shifted = shiftReturns({ ...inputs, investReturn: 6, lifeCourse }, -2)
    expect(shifted.investReturn).toBe(4)
    expect(shifted.lifeCourse!.superReturn).toBeCloseTo(0.05, 10)
    expect(shiftReturns(inputs, 2).lifeCourse).toBeUndefined()
  })

  it('grows investments at the return less, as expected, and more', () => {
    const r = runRange(inputs, 2)
    // 100,000 × 0.98^n, × 1, × 1.02^n, to the dollar
    expect(r.low.base.investArr).toEqual([98_000, 96_040, 94_119])
    expect(r.mid.base.investArr).toEqual([100_000, 100_000, 100_000])
    expect(r.high.base.investArr).toEqual([102_000, 104_040, 106_121])
  })

  it('a spread of 0 is the plan alone', () => {
    const r = runRange(inputs, 0)
    expect(r.spread).toBe(0)
    expect(r.low).toBe(r.mid)
    expect(r.high).toBe(r.mid)
    expect(DEFAULT_RETURN_SPREAD).toBe(2)
  })

  it('summarises the end net worth and when money runs short in each case', () => {
    // A life course with a large retirement goal and little saved, so the worse case runs short first.
    const lc = { ...lifeCourse, person1Age: 60, person1RetirementAge: 62, person1Super: 300_000, retirementSpending: 60_000 }
    const r = runRange(makeProjectionInputs({ mortBalance: 0, mortPayment: 0, cashOnHand: 0, projYears: 30, lifeCourse: lc, investReturn: 5 }), 2)
    const s = summariseRange(r, FX_YEAR, 60)
    expect(s.endNetWorth.low).toBeLessThan(s.endNetWorth.mid)
    expect(s.endNetWorth.mid).toBeLessThan(s.endNetWorth.high)
    expect(s.endNetWorth.mid).toBe(mainOf(r.mid).nwArr[29])
    // Runs short in the worse case, and no earlier than that in the better one.
    expect(s.runsOutAge.low).not.toBeNull()
    expect(s.runsOutAge.high === null || s.runsOutAge.high >= s.runsOutAge.low!).toBe(true)
    expect(s.runsOutAge.low).toBe(60 + (mainOf(r.low).shortfallYr! - FX_YEAR))
  })
})
