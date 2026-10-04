import { describe, it, expect } from 'vitest'
import { runProjections } from '@/lib/projections'
import { simulateMortgageYear } from '@/lib/mortgage'
import { calcAfterTax, calcHELPRepayment } from '@/lib/tax'
import { makeProjectionInputs, renterBuyingIn } from './fixtures/projections'
import { PPL_TOTAL, PPL_WEEKS, PPL_MONTHS } from '@/lib/constants'

describe('mortgage payoff', () => {
  // 50k at 6% with $3,000/month clears during the second year.
  const { base } = runProjections(makeProjectionInputs({ mortBalance: 50_000 }))

  it('clears the loan and keeps it at zero', () => {
    expect(base.mortArr[0]).toBeGreaterThan(0)
    expect(base.mortArr.slice(1)).toEqual([0, 0, 0, 0])
  })

  it('stops charging repayments once cleared (no phantom mortgage)', () => {
    expect(base.expArr[0]).toBe(60_000 + 36_000)   // full year of repayments
    expect(base.expArr[1]).toBeGreaterThan(60_000) // final, partial year
    expect(base.expArr[1]).toBeLessThan(96_000)
    expect(base.expArr.slice(2)).toEqual([60_000, 60_000, 60_000])
  })

  it('mortgage stress drops to zero after payoff', () => {
    expect(base.mortStressArr[0]).toBe(15)
    expect(base.mortStressArr.slice(2)).toEqual([0, 0, 0])
  })

  it('repayments never inflate with expenses', () => {
    const inflated = runProjections(makeProjectionInputs({ expInflNear: 4, expInfl: 4 })).base
    // Only the 60k non-mortgage base grows; repayments stay 36k.
    expect(inflated.expArr[0]).toBe(Math.round(60_000 * 1.04 + 36_000))
  })

  it("a purchase-plan mortgage is paid from cash, like the current one", () => {
    const { base: b } = runProjections(renterBuyingIn(3))
    expect(b.mortStressArr).toEqual([0, 0, 19.2, 19.2, 19.2])
  })
})

describe('simulateMortgageYear', () => {
  it('pays only what is owed in the final month', () => {
    const r = simulateMortgageYear(1_000, 0, 0, 3_000, 0)
    expect(r.annualPaid).toBe(1_000)
    expect(r.endBalance).toBe(0)
  })

  it('pays nothing on a cleared loan and passes net flow straight to cash', () => {
    const r = simulateMortgageYear(0, 100, 0.06, 3_000, 500)
    expect(r.annualPaid).toBe(0)
    expect(r.endCash).toBe(100 + 500 * 12)
  })
})

describe('HELP for Person 1', () => {
  const { base } = runProjections(makeProjectionInputs({ person1HasHELP: true, person1HELPBalance: 9_000 }))

  it('deducts the compulsory repayment from Person 1 take-home', () => {
    expect(base.person1Arr[0]).toBe(Math.round(calcAfterTax(120_000) - calcHELPRepayment(120_000)))
    expect(base.person2Arr[0]).toBe(91_080) // Person 2 unaffected
  })

  it('clears and reports the year for Person 1 only', () => {
    expect(base.person1HelpClearedYr).toBe(2028)
    expect(base.person2HelpClearedYr).toBeNull()
    expect(base.person1Arr[2]).toBe(91_080)
  })

  it('ignores a balance when HELP is off for that person', () => {
    const off = runProjections(makeProjectionInputs({ person1HasHELP: false, person1HELPBalance: 9_000 })).base
    expect(off.person1Arr[0]).toBe(91_080)
  })
})

describe('HELP indexation', () => {
  it('grows the balance with inflation before repayments, delaying clearance', () => {
    const flat = runProjections(makeProjectionInputs({ person2HasHELP: true, person2HELPBalance: 15_000 })).base
    const indexed = runProjections(makeProjectionInputs({
      person2HasHELP: true, person2HELPBalance: 15_000, expInflNear: 10, expInfl: 10,
    })).base
    expect(flat.person2HelpClearedYr).toBe(2028)
    expect(indexed.person2HelpClearedYr).toBe(2029)
  })
})

describe('simple (non-tax) mode', () => {
  it("uses Person 2's own entered net pay and growth rate", () => {
    const { base } = runProjections(makeProjectionInputs({
      taxMode: false, person2MonthlyNet: 5_000, person2GrowthRate: 10, person1GrowthRate: 0,
    }))
    expect(base.person2Arr[0]).toBe(Math.round(5_000 * 12 * 1.1))
  })
})

describe('Paid Parental Leave', () => {
  it('uses the FY2026-27 rate: 26 weeks at $1,004.70/week', () => {
    expect(PPL_WEEKS).toBe(26)
    expect(PPL_TOTAL).toBeCloseTo(26_122.2, 6)
    expect(PPL_MONTHS).toBe(6)
  })

  it('is indexed for leave taken in later years', () => {
    const leaveIn = (yr: number) => runProjections(makeProjectionInputs({
      expInflNear: 4, expInfl: 4,
      person2Phases: [{ year: 2026, days: 5 }, { year: yr, days: 0 }, { year: yr + 1, days: 5 }],
    })).base
    const early = leaveIn(2027).person2Arr[0]
    const later = leaveIn(2029).person2Arr[2]
    expect(early).toBe(Math.round(calcAfterTax(PPL_TOTAL)))
    expect(later).toBeGreaterThan(early)
  })
})
