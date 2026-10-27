import { describe, it, expect } from 'vitest'
import { moneyIn, leftOver, workingYears, tightWorkingYears, stressYears, MORTGAGE_STRESS_PCT } from '../src/yearByYear'
import { DRAWDOWN_CHOICES, DRAWDOWN_STRATEGIES } from '../src/retirement'

const run = {
  person1Arr:   [80_000, 82_000, 0, 0],
  person2Arr:   [40_000, 41_000, 0, 0],
  superDrawArr: [0, 0, 50_000, 52_000],
  investIncArr: [1_000, -500, 2_000, 2_000],
  expArr:       [110_000, 125_000, 60_000, 50_000],
  deficitArr:   [10_000, -2_000, -8_000, 4_000],
  retiredArr:   [false, false, true, true],
  mortStressArr:[32, 30, 12, 0],
}

describe('money in and left over', () => {
  it('adds pay, super drawn and investment income', () => {
    // 80,000 + 40,000 + 0 + 1,000 = 121,000; 82,000 + 41,000 − 500 = 122,500; 0 + 0 + 50,000 + 2,000 = 52,000
    expect(moneyIn(run, true)).toEqual([121_000, 122_500, 52_000, 54_000])
  })

  it('leaves out the partner when there isn’t one', () => {
    // 80,000 + 1,000 = 81,000; 82,000 − 500 = 81,500
    expect(moneyIn(run, false)).toEqual([81_000, 81_500, 52_000, 54_000])
  })

  it('works without super or investment income', () => {
    expect(moneyIn({ person1Arr: [10], person2Arr: [5] }, true)).toEqual([15])
  })

  it('takes spending off', () => {
    // 121,000 − 110,000 = 11,000; 122,500 − 125,000 = −2,500; 52,000 − 60,000 = −8,000; 54,000 − 50,000 = 4,000
    expect(leftOver(run, true)).toEqual([11_000, -2_500, -8_000, 4_000])
  })
})

describe('working years', () => {
  it('ends at the first year everyone has retired', () => {
    expect(workingYears(run)).toBe(2)
  })

  it('runs to the end when nobody retires within the horizon', () => {
    expect(workingYears({ retiredArr: [false, false], deficitArr: [1, 2] })).toBe(2)
    expect(workingYears({ retiredArr: [], deficitArr: [1, 2, 3] })).toBe(3)
  })

  it('counts only tight years before retirement', () => {
    // Year 2's shortfall is in retirement, where living on savings is the plan.
    expect(tightWorkingYears(run)).toEqual([1])
  })
})

describe('mortgage stress', () => {
  it('flags years above the line, not on it', () => {
    expect(MORTGAGE_STRESS_PCT).toBe(30)
    expect(stressYears(run)).toEqual([0])
  })
})

describe('drawdown choices', () => {
  it('has one choice per strategy, in the same order', () => {
    expect(DRAWDOWN_CHOICES.map(c => c.key)).toEqual(DRAWDOWN_STRATEGIES)
  })
})
