import { describe, it, expect } from 'vitest'
import {
  capFor, evStatus, packageYear, packagingNow, netPay, packagingSaving, NO_PACKAGE,
  FBT_GROSS_UP_TYPE2, PACKAGING_CAPS_GROSSED_UP, EV_PRICE_LIMIT, type PackagedItemLike,
} from '../src/packaging'
import { calcAfterTax } from '../src/tax'
import { computeBudgetSummary } from '../src/budgetSummary'
import { runProjections } from '../src/projections'
import { makeProjectionInputs, FX_YEAR } from './fixtures/projections'

// FY2026-27: 15% from $18,200, 30% from $45,000, 2% Medicare, no LITO above
// $66,667. FBT year ending 31 March 2027 (ATO): Type 2 gross-up 1.8868; caps
// $30,000 (charities), $17,000 (hospitals), $5,000 (meal entertainment), all
// grossed up; reportable once the taxable value is over $2,000.

const item = (o: Partial<PackagedItemLike>): PackagedItemLike =>
  ({ person: 'p1', kind: 'hospital', amount: 0, carPrice: null, startYear: 2026, endYear: null, ...o })

describe('caps and the electric-car rules', () => {
  it('turns grossed-up caps into tax-free amounts: $15,900, $9,010, $2,650', () => {
    expect(FBT_GROSS_UP_TYPE2).toBe(1.8868)
    expect(PACKAGING_CAPS_GROSSED_UP).toEqual({ pbi: 30_000, hospital: 17_000, mealEntertainment: 5_000 })
    expect(capFor('pbi')).toBeCloseTo(15_899.94, 2)
    expect(capFor('hospital')).toBeCloseTo(9_009.96, 2)
    expect(capFor('mealEntertainment')).toBeCloseTo(2_649.99, 2)
  })

  it('an electric car qualifies under the price limit; over $75,000 from 2027 is the announced change', () => {
    expect(EV_PRICE_LIMIT).toBe(91_661)
    expect(evStatus(95_000, 2026)).toBe('overPriceLimit')
    expect(evStatus(80_000, 2026)).toBe('exempt')        // existing leases keep the exemption
    expect(evStatus(80_000, 2027)).toBe('announcedChange')
    expect(evStatus(70_000, 2028)).toBe('exempt')
  })
})

describe('a year of packaging', () => {
  it('caps not-for-profit packaging, with meal entertainment on top', () => {
    const y = packageYear([item({ kind: 'pbi', amount: 20_000 }), item({ kind: 'mealEntertainment', amount: 3_000 })], 'p1', 2026)
    expect(y.pretax).toBeCloseTo(15_899.94 + 2_649.99, 1)
    // Reportable: the taxable value grossed up = 30,000 + 5,000.
    expect(y.reportable).toBeCloseTo(35_000, 0)
  })

  it('an electric car: lease and running costs pre-tax; reportable is 20% of its price grossed up', () => {
    const y = packageYear([item({ kind: 'evLease', amount: 15_000, carPrice: 60_000 })], 'p1', 2026)
    expect(y.pretax).toBe(15_000)
    // 60,000 × 20% = 12,000 × 1.8868 = 22,641.60
    expect(y.reportable).toBeCloseTo(22_641.6, 1)
  })

  it('a car over the limit, small amounts, other people, other years and unknown kinds don’t count', () => {
    expect(packageYear([item({ kind: 'evLease', amount: 15_000, carPrice: 100_000 })], 'p1', 2026)).toEqual(NO_PACKAGE)
    // $1,000 of meal entertainment: under the $2,000 reporting threshold.
    expect(packageYear([item({ kind: 'mealEntertainment', amount: 1_000 })], 'p1', 2026)).toEqual({ pretax: 1_000, reportable: 0 })
    expect(packageYear([item({ amount: 5_000, person: 'p2' })], 'p1', 2026)).toEqual(NO_PACKAGE)
    expect(packageYear([item({ amount: 5_000, startYear: 2028 })], 'p1', 2027)).toEqual(NO_PACKAGE)
    expect(packageYear([item({ amount: 5_000, endYear: 2027 })], 'p1', 2028)).toEqual(NO_PACKAGE)
    expect(packageYear([item({ amount: 5_000, kind: 'somethingNew' })], 'p1', 2026)).toEqual(NO_PACKAGE)
  })
})

describe('take-home pay', () => {
  const hospital = packageYear([item({ amount: 20_000 })], 'p1', 2026)   // capped at 9,009.96

  it('without packaging it is the usual figure', () => {
    expect(netPay(80_000, 0, false)).toBe(calcAfterTax(80_000))
    expect(netPay(80_000, 0, true)).toBe(calcAfterTax(80_000, true))
  })

  it('a hospital worker on $80,000 packaging the cap keeps $2,883 more', () => {
    // Taxed on 70,990.04 instead of 80,000: 9,009.96 less at 32%.
    expect(packagingSaving(80_000, false, hospital)).toBeCloseTo(2_883.19, 1)
  })

  it('with a HELP debt most of that goes on HELP: the reportable amount counts as repayment income', () => {
    // Repayment income 80,000 + 17,000 = 97,000: (97,000 − 69,528) × 15% = 4,121
    // instead of (80,000 − 69,528) × 15% = 1,571. 2,883.19 − 2,550 = 333.19.
    expect(packagingSaving(80_000, true, hospital)).toBeCloseTo(333.19, 1)
  })

  it('today’s budget includes it, and says how much it adds', () => {
    const base = {
      expenses: [], annualExpenses: [], childcare: { enabled: false, costPerDay: 0, daysPerWeek: 0, numChildren: 0 },
      income: { taxMode: true, person1FTE: 80_000, person2FTE: 0, person1HasHELP: false, person2HasHELP: false, person1MonthlyNet: 0, person2MonthlyNet: 0 },
      rentMonthly: null, person1Days: 5, person2Days: 5, partnerEnabled: false,
    }
    const without = computeBudgetSummary(base)
    const withIt = computeBudgetSummary({ ...base, packaging: packagingNow([item({ amount: 20_000 })], 2026, { p1: 5, p2: 5 }) })
    expect(without.packagingMonthly).toBe(0)
    expect(withIt.packagingMonthly).toBeCloseTo(2_883.19 / 12, 2)
    expect(withIt.monthlyIncome - without.monthlyIncome).toBeCloseTo(2_883.19 / 12, 2)
    // Not working this year: nothing packaged.
    expect(packagingNow([item({ amount: 20_000 })], 2026, { p1: 0, p2: 5 }).p1).toEqual(NO_PACKAGE)
  })
})

describe('in the projection', () => {
  // Fixture: two people on $120,000, every dial at 0, no HELP.
  const base = makeProjectionInputs({ mortBalance: 0, mortPayment: 0, projYears: 3 })
  const car = item({ kind: 'evLease', amount: 15_000, carPrice: 60_000, startYear: FX_YEAR, endYear: FX_YEAR + 2 })

  it('an electric car lease saves 32% of its cost while it runs: $4,800 a year', () => {
    const off = runProjections(base).base
    const on = runProjections({ ...base, packaging: [car] }).base
    // 120,000 → 105,000 taxable, all at 30% + 2%. Runs 2027 and 2028, not 2029.
    expect(on.packagingArr).toEqual([4_800, 4_800, 0])
    expect(on.person1Arr[0] - off.person1Arr[0]).toBe(4_800)
    expect(on.person2Arr).toEqual(off.person2Arr)
    expect(off.packagingArr).toEqual([0, 0, 0])
  })
})
