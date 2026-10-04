import { describe, it, expect } from 'vitest'
import { runProjections, type ProjectionResult } from '@/lib/projections'
import { computeMonthlyRepayment } from '@/lib/mortgage'
import { calcAfterTax } from '@/lib/tax'
import { PPL_TOTAL } from '@/lib/constants'
import {
  makeProjectionInputs, renter, renterBuyingIn, withLeave,
} from './fixtures/projections'

// Scenario values below fall into two categories:
//  - DERIVED: hand-computed from the pure formulas (tax, rent compounding,
//    school fee schedule, PPL constants) and shown with the arithmetic in a
//    comment, matching the house style in tests/tax.test.ts.
//  - CHARACTERIZED: the engine's monthly mortgage/offset loop and the
//    invest-surplus loop compound many small steps that aren't reasonably
//    hand-derivable to the dollar; these values were captured by running the
//    real engine against the fixture and are pinned as a regression guard.
//    Where a characterized value can be cross-checked against a derived one
//    (e.g. the conservation identity), that check is included.

function expectShape(r: ProjectionResult, years: number) {
  expect(Object.keys(r).sort()).toEqual([
    'cashArr', 'cashRunningArr', 'deficitArr', 'expArr', 'incArr',
    'investArr', 'leaveYrs', 'mortArr', 'mortStressArr', 'nwArr', 'person1Arr',
    'person1HelpClearedYr', 'person2Arr', 'person2HelpClearedYr', 'phaseArr', 'purchaseYr', 'rentArr', 'sfC1Arr', 'sfC2Arr',
    'sfSibArr', 'sfTotalArr',
  ])
  for (const k of ['nwArr', 'incArr', 'expArr', 'mortArr', 'cashArr', 'investArr'] as const) {
    expect(r[k]).toHaveLength(years)
    expect(r[k].every(Number.isFinite)).toBe(true)
    expect(r[k].every(Number.isInteger)).toBe(true) // all Math.round()ed by the engine
  }
  expect(r.cashArr.every(v => v >= 0)).toBe(true)
  expect(r.mortArr.every(v => v >= 0)).toBe(true)
}

/** nw === (property equity) + cash + invest + crypto − helpNetWorthDebt, to within rounding slack. */
function expectConservation(r: ProjectionResult, propValue: number, crypto: number) {
  r.nwArr.forEach((nw, i) => {
    const rebuilt = propValue - r.mortArr[i] + r.cashArr[i] + r.investArr[i] + crypto
    expect(Math.abs(nw - rebuilt)).toBeLessThanOrEqual(3)
  })
}

describe('runProjections — S1 homeowner baseline (all dials at 0)', () => {
  const { base, withFees, labels } = runProjections(makeProjectionInputs())

  it('has the expected shape and labels', () => {
    expectShape(base, 5)
    expect(labels).toEqual(['2027', '2028', '2029', '2030', '2031'])
    expect(withFees).toBeNull()
  })

  it('income is flat: 2 × calcAfterTax(120000) = 2 × 91080 (pinned in tests/tax.test.ts)', () => {
    expect(base.incArr).toEqual([182160, 182160, 182160, 182160, 182160])
  })

  it('expenses are flat with no inflation: 8000 × 12', () => {
    expect(base.expArr).toEqual([96000, 96000, 96000, 96000, 96000])
  })

  it('deficit is income minus expense, flat', () => {
    expect(base.deficitArr).toEqual([86160, 86160, 86160, 86160, 86160])
  })

  it('mortgage stress: 3000 × 12 / 240000 × 100 = 15%, flat (no growth)', () => {
    expect(base.mortStressArr).toEqual([15, 15, 15, 15, 15])
  })

  it('no rent, no fees, no leave, no HELP clearing, no purchase plan', () => {
    expect(base.rentArr).toEqual([0, 0, 0, 0, 0])
    expect(base.sfTotalArr).toEqual([0, 0, 0, 0, 0])
    expect(base.leaveYrs).toEqual([])
    expect(base.person1HelpClearedYr).toBeNull()
    expect(base.person2HelpClearedYr).toBeNull()
    expect(base.purchaseYr).toBeNull()
  })

  it('mortgage balance is strictly non-increasing', () => {
    for (let i = 1; i < base.mortArr.length; i++) expect(base.mortArr[i]).toBeLessThan(base.mortArr[i - 1])
  })

  it('conserves net worth against its components (property flat at 800k, no growth)', () => {
    expectConservation(base, 800_000, 10_000)
  })

  it('CHARACTERIZED: mortgage/cash trajectory from the monthly offset loop', () => {
    expect(base.mortArr).toEqual([382171, 357929, 326877, 291010, 255010])
    expect(base.cashArr).toEqual([136160, 222320, 308480, 394640, 480800])
    expect(base.investArr).toEqual([0, 0, 0, 0, 0])
    expect(base.nwArr).toEqual([563989, 674391, 791603, 913630, 1035790])
  })
})

describe('runProjections — S2 stepped inflation (near-term 2026-28, long-run 2029+)', () => {
  // projections.ts:180 hardcodes the switch at yr<=2028. Fixture year 2027(i=0)
  // and 2028(i=1) use expInflNear=4%; 2029(i=2) onward switches to expInfl=2.5%.
  const { base } = runProjections(makeProjectionInputs({ expInflNear: 4, expInfl: 2.5 }))

  it('applies the near-term rate through 2028, then the long-run rate from 2029', () => {
    // expBase compounds *before* being pushed each year, so year i's expArr
    // reflects (i+1) applications of the rate(s) up to and including yr. Only
    // the non-mortgage base (60k) inflates; the 36k of repayments is fixed.
    const e0 = 60000 * 1.04            // 2027
    const e1 = e0 * 1.04                // 2028 (still near-term: yr<=2028)
    const e2 = e1 * 1.025                // 2029 (switches to long-run)
    const e3 = e2 * 1.025                // 2030
    expect(base.expArr[0]).toBe(Math.round(e0 + 36000))
    expect(base.expArr[1]).toBe(Math.round(e1 + 36000))
    expect(base.expArr[2]).toBe(Math.round(e2 + 36000))
    expect(base.expArr[3]).toBe(Math.round(e3 + 36000))
  })
})

describe('runProjections — S3 renter', () => {
  const { base } = runProjections(renter({ rentIncreaseRate: 5 }))

  it('has no mortgage and no mortgage stress', () => {
    expect(base.mortArr).toEqual([0, 0, 0, 0, 0])
    expect(base.mortStressArr).toEqual([0, 0, 0, 0, 0])
    expect(base.purchaseYr).toBeNull()
  })

  it('rent compounds at rentIncreaseRate: 30000 × 1.05^i', () => {
    expect(base.rentArr).toEqual([30000, 31500, 33075, 34729, 36465])
  })

  it('does not double-count rent: expArr = baseExpenses + rentArr', () => {
    base.expArr.forEach((exp, i) => expect(exp).toBe(96000 + base.rentArr[i]))
  })

  it('net worth excludes property (renter has none)', () => {
    expectConservation(base, 0, 10_000)
  })
})

describe('runProjections — S4 renter transitioning to owner at year 3 (2029)', () => {
  const { base } = runProjections(renterBuyingIn(3))

  it('marks the purchase year and zeroes rent from that year on', () => {
    expect(base.purchaseYr).toBe(2029)
    // rentAnnual is zeroed IN the transition year itself (projections.ts:247)
    expect(base.rentArr).toEqual([30000, 30000, 0, 0, 0])
  })

  it('has no mortgage before the purchase year, a real one from it', () => {
    expect(base.mortArr[0]).toBe(0)
    expect(base.mortArr[1]).toBe(0)
    expect(base.mortArr[2]).toBeGreaterThan(0)
  })

  it('the new mortgage repayment is computeMonthlyRepayment on the financed balance', () => {
    // deposit 20% of 800k target → financed 640,000 over 30yr @ 6%
    const payment = computeMonthlyRepayment(640_000, 6, 360)
    expect(payment).toBe(3837)
    const grossHousehold = 240_000 // both persons flat at 120k gross, unaffected by housing
    const expectedStress = parseFloat(((payment * 12) / grossHousehold * 100).toFixed(1))
    expect(base.mortStressArr[2]).toBe(expectedStress)
    expect(base.mortStressArr).toEqual([0, 0, 19.2, 19.2, 19.2])
  })

  it('CHARACTERIZED: post-purchase mortgage/cash/nw trajectory', () => {
    expect(base.mortArr).toEqual([0, 0, 621009, 598372, 571865])
    expect(base.cashArr).toEqual([106160, 162320, 202436, 242552, 282668])
    expect(base.nwArr).toEqual([116160, 172320, 391427, 454180, 520803])
  })
})

describe('runProjections — S4b purchase deposit funded from investments (12% CGT haircut)', () => {
  const { base } = runProjections(
    renterBuyingIn(3, { savingsRate: 100, investReturn: 0, depositFromInvestments: 50_000 }),
  )

  it('deducts the deposit plus a 12% haircut from accumulated investments, then resumes investing', () => {
    // Pre-purchase, 100% of surplus is invested each year at 0% return:
    // investArr[0] = surplus_2027 = 56160; investArr[1] = 56160×2 = 112320
    expect(base.investArr[0]).toBe(56160)
    expect(base.investArr[1]).toBe(112320)
    // At purchase: 112320 − 50000 (deposit) − 6000 (12% haircut on 50000) = 56320,
    // then this year's own surplus (40116, since sR=100%) is invested on top:
    // 56320 + 40116 = 96436
    expect(base.investArr[2]).toBe(96436)
  })

  it('never goes negative even when the deposit exceeds accumulated investments', () => {
    const clamped = runProjections(
      renterBuyingIn(3, { savingsRate: 100, investReturn: 0, depositFromInvestments: 200_000 }),
    ).base
    // Accumulated (112320) is entirely consumed by the oversized deposit + haircut,
    // clamped to 0 (never negative), then the same year's surplus (40116) is added.
    expect(clamped.investArr[2]).toBe(40116)
    expect(clamped.investArr.every(v => v >= 0)).toBe(true)
  })
})

describe('runProjections — S5 parental leave', () => {
  const { base } = runProjections(withLeave(2028, 3))

  it('records the leave year and pays PPL in the first leave year only', () => {
    expect(base.leaveYrs).toEqual([2028])
    // 26 weeks × PPL_WEEKLY, taxed as income
    expect(base.person2Arr[1]).toBe(Math.round(calcAfterTax(PPL_TOTAL)))
  })

  it('pays nothing on leave when parentalLeaveEnabled is false', () => {
    const off = runProjections(withLeave(2028, 3, { parentalLeaveEnabled: false })).base
    expect(off.person2Arr[1]).toBe(0)
    expect(off.leaveYrs).toEqual([2028]) // still recorded as a leave year, just unpaid
  })

  it('return year is taxed at the pro-rated (3/5) gross: calcAfterTax(72000) = 58440', () => {
    // (45000-18200)*0.15 + (72000-45000)*0.30 = 4020 + 8100 = 12120 tax; LITO 0 above 66667
    // medicare 72000*0.02 = 1440; afterTax = 72000 - 12120 - 1440 = 58440
    expect(base.person2Arr[2]).toBe(58440)
  })

  it('mortgage stress rises in the leave year (household gross income falls)', () => {
    expect(base.mortStressArr[1]).toBeGreaterThan(base.mortStressArr[0])
    // 3000×12 / (120000 gross + PPL gross) × 100
    expect(base.mortStressArr[1]).toBe(parseFloat((36000 / (120000 + PPL_TOTAL) * 100).toFixed(1)))
  })
})

describe('runProjections — S5b two consecutive leave years (PPL edge case)', () => {
  // leaveSt only records the phase's START year (projections.ts:167), so a
  // days:0 phase spanning two calendar years pays PPL exactly once, in the
  // first year — NOT re-derivable by inspection without reading that line.
  const { base } = runProjections(makeProjectionInputs({
    person2Phases: [{ year: 2026, days: 5 }, { year: 2027, days: 0 }, { year: 2029, days: 5 }],
  }))

  it('flags both years as on-leave but pays PPL only in the first', () => {
    expect(base.leaveYrs).toEqual([2027, 2028])
    expect(base.person2Arr[0]).toBe(Math.round(calcAfterTax(PPL_TOTAL))) // 2027 — first leave year, PPL paid
    expect(base.person2Arr[1]).toBe(0)    // 2028 — still on leave, no PPL
    expect(base.person2Arr[2]).toBe(91080) // 2029 — back full-time
  })
})

describe('runProjections — S6 school fees on, sfInfl=0 (schedule figures appear literally)', () => {
  const { base, withFees } = runProjections(makeProjectionInputs({ schoolFeesOn: true }))

  it('the dual-run contract: base has zero fees, withFees does not', () => {
    expect(withFees).not.toBeNull()
    expect(base.sfTotalArr).toEqual([0, 0, 0, 0, 0])
    expect(base.expArr).toEqual([96000, 96000, 96000, 96000, 96000])
  })

  it('headline invariant: net worth with fees never exceeds net worth without', () => {
    withFees!.nwArr.forEach((nw, i) => expect(nw).toBeLessThanOrEqual(base.nwArr[i]))
  })

  it('C1 enters at Kindergarten (2027) and the fee/CML figures match SF_BASE', () => {
    // Kindergarten: tuition 5000 + fixed 500 = 5500; CML 350 (see tests/schoolFees.test.ts)
    expect(withFees!.sfC1Arr[0]).toBe(5500)
    expect(withFees!.sfTotalArr[0]).toBe(5850)
  })

  it('sibling discount applies once C2 also enters (2029)', () => {
    // C1 idx=2 "Year 1" (9000+1000); C2 idx=0 "Kindergarten" (5000+500); disc = 5000×0.15=750
    expect(withFees!.sfC1Arr[2]).toBe(10000)
    expect(withFees!.sfC2Arr[2]).toBe(4750)
    expect(withFees!.sfSibArr[2]).toBe(750)
  })

  it('CHARACTERIZED: fee-adjusted expense/mortgage/cash trajectory', () => {
    expect(withFees!.expArr).toEqual([101850, 105350, 111100, 114150, 116000])
    expect(withFees!.nwArr).toEqual([557975, 658395, 759099, 862217, 964377])
  })
})

describe('runProjections — S6b the drift regression (sfInfl=5, currentYear=2026)', () => {
  // This is the test that justifies Phase 15's clock-anchor fix: SF_BASE is
  // priced in 2026 dollars. Before the fix, schoolFeesForYear anchors to the
  // WALL CLOCK, not `currentYear`/MODEL_BASE_YEAR — so this exact assertion
  // is only valid while the wall clock reads 2026, and silently drifts one
  // step of compounding for every year that passes. It is written now (still
  // 2026) so the anchor fix can be proven to leave it byte-identical.
  const { withFees } = runProjections(makeProjectionInputs({ schoolFeesOn: true, sfInfl: 5 }))

  it('C1 fee inflates from the 2026 base by one year at 5%', () => {
    // 5500 × 1.05^(2027-2026) = 5775
    expect(withFees!.sfC1Arr[0]).toBe(5775)
    expect(withFees!.sfTotalArr[0]).toBe(6143) // 5775 + 350×1.05=367.5 → 6142.5 rounds to 6143
  })
})

describe('runProjections — S7 HELP clearing', () => {
  const { base } = runProjections(makeProjectionInputs({
    person2HasHELP: true, person2HELPBalance: 9_000,
  }))

  it('clears in the second year and reports the correct year', () => {
    expect(base.person2HelpClearedYr).toBe(2028)
    expect(base.person1HelpClearedYr).toBeNull()
  })

  it('deducts the full statutory repayment in year 1: calcAfterTax(120000,true) = 91080 - 7571', () => {
    expect(base.person2Arr[0]).toBe(83509)
  })

  it('the clearing year deducts only the residual owed (1429), not the full repayment', () => {
    expect(base.person2Arr[1]).toBe(89651) // 91080 − 1429
  })

  it('counts the outstanding HELP balance as a debt in net worth', () => {
    // No mortgage, so lower cash doesn't also change offset interest.
    const noLoan = { mortBalance: 0, mortPayment: 0 }
    const noHelp = runProjections(makeProjectionInputs(noLoan)).base
    const withHelp = runProjections(makeProjectionInputs({ ...noLoan, person2HasHELP: true, person2HELPBalance: 9_000 })).base
    // End of year 1: 1429 still owed, and 7571 less take-home than without HELP.
    expect(noHelp.nwArr[0] - withHelp.nwArr[0]).toBe(1429 + 7571)
  })

  it('once cleared, income returns to the no-HELP figure', () => {
    expect(base.person2Arr[2]).toBe(91080)
  })
})

describe('runProjections — S8 deficit year', () => {
  // 17k + the 3k mortgage repayment = 20k/month = 240k/yr of expenses.
  const { base } = runProjections(makeProjectionInputs({ baseMonthlyExpenses: 17_000 }))

  it('runs a flat deficit: 182160 - 240000 = -57840', () => {
    expect(base.deficitArr).toEqual([-57840, -57840, -57840, -57840, -57840])
  })

  it('cash floors at zero and never goes negative', () => {
    expect(base.cashArr.every(v => v === 0)).toBe(true)
  })

  it('nothing is invested when there is no surplus', () => {
    expect(base.investArr.every(v => v === 0)).toBe(true)
  })

  it('mortgage still amortises (payments continue funding principal from a zero-cash offset)', () => {
    for (let i = 1; i < base.mortArr.length; i++) expect(base.mortArr[i]).toBeLessThan(base.mortArr[i - 1])
  })
})

describe('runProjections — S9 one-off expense', () => {
  const baseline = runProjections(makeProjectionInputs()).base
  const { base } = runProjections(makeProjectionInputs({
    oneoffs: [{ name: 'Roof', amt: 20_000, year: 2029 }],
  }))

  it('does NOT appear in deficitArr — an intentional asymmetry (projections.ts:335 excludes one-offs)', () => {
    expect(base.deficitArr).toEqual(baseline.deficitArr)
  })

  it('DOES reduce cash (and therefore net worth) in the year it lands, by exactly its amount', () => {
    expect(baseline.cashArr[2] - base.cashArr[2]).toBe(20_000)
    expect(baseline.nwArr[2] - base.nwArr[2]).toBe(20_000)
  })
})

describe('runProjections — S10 empty phase arrays (crash regression)', () => {
  it('does not throw with an empty person2Phases (falls back to 5 days/week, matching the person1 fallback)', () => {
    expect(() => runProjections(makeProjectionInputs({ person2Phases: [] }))).not.toThrow()
    const { base } = runProjections(makeProjectionInputs({ person2Phases: [] }))
    expect(base.person2Arr).toEqual([91080, 91080, 91080, 91080, 91080])
    expect(base.leaveYrs).toEqual([])
  })

  it('does not throw with an empty person1Phases either (symmetry)', () => {
    expect(() => runProjections(makeProjectionInputs({ person1Phases: [] }))).not.toThrow()
    const { base } = runProjections(makeProjectionInputs({ person1Phases: [] }))
    expect(base.person1Arr).toEqual([91080, 91080, 91080, 91080, 91080])
  })
})
