import { describe, it, expect } from 'vitest'
import {
  frankingCredit, taxOn, taxOnTop, grossFromNet, investIncomeYear, FRANKING_COMPANY_RATE,
  DEFAULT_DIVIDEND_YIELD, DEFAULT_FRANKED_PCT, DEFAULT_CASH_RATE, DEFAULT_PERSON1_SHARE, type InvestIncomeSettings,
} from '../src/investmentIncome'
import { calcAfterTax } from '../src/tax'
import { runProjections } from '../src/projections'
import { makeProjectionInputs } from './fixtures/projections'

// FY2026-27 rates: 30% from $45,000, 37% from $135,000, 45% from $190,000,
// plus the 2% Medicare levy; no LITO above $66,667; nothing up to $18,200,
// and no levy up to $28,011.

describe('franking credits', () => {
  it('carry the 30% company tax: a $1,000 fully franked dividend has a $428.57 credit', () => {
    expect(FRANKING_COMPANY_RATE).toBe(0.3)
    expect(frankingCredit(1_000, 100)).toBeCloseTo(428.57, 2)
    expect(frankingCredit(1_000, 50)).toBeCloseTo(214.29, 2)
    expect(frankingCredit(1_000, 0)).toBe(0)
  })
})

describe('tax on investment income, on top of other income', () => {
  it('interest is taxed at the marginal rate: $10,000 on a $100,000 salary costs $3,200', () => {
    expect(taxOnTop(100_000, 10_000, 0)).toBeCloseTo(3_200, 2)
  })

  it('a fully franked $10,000 dividend on a $100,000 salary costs $285.71', () => {
    // Grossed up: 10,000 + 4,285.71 = 14,285.71 at 32% = 4,571.43, less the credit 4,285.71.
    const credit = frankingCredit(10_000, 100)
    expect(taxOnTop(100_000, 10_000 + credit, credit)).toBeCloseTo(285.71, 2)
  })

  it('on a $200,000 salary the same dividend costs $2,428.57', () => {
    // 14,285.71 at 47% = 6,714.29, less 4,285.71.
    const credit = frankingCredit(10_000, 100)
    expect(taxOnTop(200_000, 10_000 + credit, credit)).toBeCloseTo(2_428.57, 2)
  })

  it('with no other income, the credit is refunded in full', () => {
    // 14,285.71 is under the $18,200 tax-free threshold and the levy threshold.
    const credit = frankingCredit(10_000, 100)
    expect(taxOnTop(0, 10_000 + credit, credit)).toBeCloseTo(-4_285.71, 2)
    expect(taxOn(0)).toBe(0)
  })

  it('finds the gross pay behind a take-home figure', () => {
    expect(grossFromNet(calcAfterTax(90_000))).toBeCloseTo(90_000, 0)
    expect(grossFromNet(0)).toBe(0)
  })
})

describe('a year of investment income', () => {
  const s: InvestIncomeSettings = { dividendYield: 3, frankedPct: 50, cashRate: 4, person1Share: 50 }

  it('defaults: a 3% yield, half franked, 4% on savings, split evenly', () => {
    expect([DEFAULT_DIVIDEND_YIELD, DEFAULT_FRANKED_PCT, DEFAULT_CASH_RATE, DEFAULT_PERSON1_SHARE]).toEqual([3, 50, 4, 50])
  })

  it('earns interest only on cash above the loan, and splits the tax between two people', () => {
    // Cash 120,000 against a 100,000 loan: 20,000 earns 4% = 800.
    // Investments 200,000 at 3% = 6,000 of dividends; half franked: credit 1,285.71.
    // Assessable 800 + 6,000 + 1,285.71 = 8,085.71, half each on $100,000 salaries:
    // 4,042.86 × 32% = 1,293.71 − 642.86 = 650.86 each, 1,301.71 in all.
    const y = investIncomeYear(s, { cash: 120_000, loan: 100_000, invest: 200_000 }, [100_000, 100_000], true)
    expect(y.interest).toBeCloseTo(800, 6)
    expect(y.dividends).toBeCloseTo(6_000, 6)
    expect(y.credits).toBeCloseTo(1_285.71, 2)
    expect(y.tax).toBeCloseTo(1_301.71, 2)
    expect(y.cash).toBeCloseTo(800 - 1_301.71, 2)
  })

  it('in the lower earner’s name it costs less', () => {
    const even = investIncomeYear(s, { cash: 0, loan: 0, invest: 500_000 }, [150_000, 30_000], true).tax
    const lower = investIncomeYear({ ...s, person1Share: 0 }, { cash: 0, loan: 0, invest: 500_000 }, [150_000, 30_000], true).tax
    expect(lower).toBeLessThan(even)
  })

  it('without a partner it is all Person 1’s, whatever the share says', () => {
    const y = investIncomeYear({ ...s, person1Share: 0 }, { cash: 50_000, loan: 0, invest: 0 }, [100_000, 0], false)
    expect(y.tax).toBeCloseTo(2_000 * 0.32, 6)
  })
})

describe('in the projection', () => {
  // Fixture: every dial at 0, two people on $120,000 (32% marginal), no loan.
  const base = makeProjectionInputs({ mortBalance: 0, mortPayment: 0, cashOnHand: 50_000, investmentsValue: 100_000, projYears: 2 })
  const off = runProjections(base).base

  it('without the setting, nothing changes (cash earns nothing, investments untaxed)', () => {
    expect(off.interestArr).toEqual([0, 0])
    expect(off.investTaxArr).toEqual([0, 0])
  })

  it('cash earns interest, less tax, in the first year: 50,000 × 4% = 2,000, less 32% = 1,360 more cash', () => {
    const on = runProjections({ ...base, investIncome: { dividendYield: 0, frankedPct: 0, cashRate: 4, person1Share: 50 } }).base
    expect(on.interestArr[0]).toBe(2_000)
    expect(on.investTaxArr[0]).toBe(640)
    expect(on.cashArr[0] - off.cashArr[0]).toBe(1_360)
    expect(on.incArr[0] - off.incArr[0]).toBe(1_360)
  })

  it('dividends are reinvested; only their tax leaves cash', () => {
    // 100,000 × 3% = 3,000 fully franked: credit 1,285.71, assessable 4,285.71,
    // half each at 32% = 685.71 − 642.86 = 42.86 each, 85.71 in all.
    const on = runProjections({ ...base, investIncome: { dividendYield: 3, frankedPct: 100, cashRate: 0, person1Share: 50 } }).base
    expect(on.dividendArr[0]).toBe(3_000)
    expect(on.investTaxArr[0]).toBe(86)
    expect(on.investArr[0]).toBe(off.investArr[0])
    expect(off.cashArr[0] - on.cashArr[0]).toBe(86)
  })
})
