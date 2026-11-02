import { describe, it, expect } from 'vitest'
import { businessProfit, businessYear, DEFAULT_BUSINESS_GROWTH, type IncomeSourceLike } from '../src/businessIncome'
import { computeBudgetSummary, type BudgetInputs } from '../src/budgetSummary'
import { moneyIn } from '../src/yearByYear'
import { runProjections, type LifeCourse } from '../src/projections'
import { makeProjectionInputs, FX_YEAR } from './fixtures/projections'

// FY2026-27 rates: 15% from $18,200, 30% from $45,000, 37% from $135,000,
// plus the 2% Medicare levy (shaded in from $28,011); LITO $700 up to
// $37,500. HELP: 15c per $1 over $69,528 up to $129,717.

const item = (o: Partial<IncomeSourceLike> = {}): IncomeSourceLike =>
  ({ person: 'p1', kind: 'business', amount: 20_000, growthPct: 0, startYear: 2026, endYear: null, ...o })

describe('business profit in a year', () => {
  it('grows from this year: $20,000 at 5% is $22,050 two years on', () => {
    expect(businessProfit([item({ growthPct: 5 })], 'p1', 2028, 2026, true)).toBeCloseTo(22_050, 6)
    expect(DEFAULT_BUSINESS_GROWTH).toBe(3)
  })

  it('counts only from its start year, and only the person named', () => {
    const items = [item({ startYear: 2028 }), item({ person: 'p2', amount: 7_000 })]
    expect(businessProfit(items, 'p1', 2027, 2026, true)).toBe(0)
    expect(businessProfit(items, 'p1', 2028, 2026, true)).toBe(20_000)
    expect(businessProfit(items, 'p2', 2027, 2026, true)).toBe(7_000)
  })

  it('with no end year it stops when the person stops work', () => {
    expect(businessProfit([item()], 'p1', 2040, 2026, false)).toBe(0)
  })

  it('an end year carries it into retirement, and stops it after', () => {
    const items = [item({ endYear: 2045 })]
    expect(businessProfit(items, 'p1', 2045, 2026, false)).toBe(20_000)
    expect(businessProfit(items, 'p1', 2046, 2026, false)).toBe(0)
  })

  it('a loss counts as nothing, and unknown kinds from newer versions are ignored', () => {
    expect(businessProfit([item({ amount: -5_000 }), item({ kind: 'rental' })], 'p1', 2026, 2026, true)).toBe(0)
  })
})

describe('tax and HELP on business profit', () => {
  it('on a $100,000 salary, $20,000 is taxed at 32%: $6,400, leaving $13,600', () => {
    expect(businessYear(20_000, 100_000, 100_000, 0)).toEqual({ profit: 20_000, tax: 6_400, help: 0, cash: 13_600 })
  })

  it('with HELP it adds 15c in the dollar: $3,000 more repaid, leaving $10,600', () => {
    // Repayment income 100,000 → 120,000, all in the 15c band: 20,000 × 15% = 3,000.
    const y = businessYear(20_000, 100_000, 100_000, 50_000)
    expect(y.help).toBeCloseTo(3_000, 6)
    expect(y.cash).toBeCloseTo(10_600, 6)
  })

  it('HELP repaid stops at what is still owed', () => {
    expect(businessYear(20_000, 100_000, 100_000, 1_000).help).toBe(1_000)
  })

  it('with no other income, $30,000 costs $1,268.90', () => {
    // (30,000 − 18,200) × 15% = 1,770, less LITO 700 = 1,070; Medicare shaded
    // in: (30,000 − 28,011) × 10% = 198.90 (under 2% = 600).
    const y = businessYear(30_000, 0, 0, 0)
    expect(y.tax).toBeCloseTo(1_268.9, 2)
    expect(y.cash).toBeCloseTo(28_731.1, 2)
  })

  it('no profit, no tax', () => {
    expect(businessYear(0, 100_000, 100_000, 50_000)).toEqual({ profit: 0, tax: 0, help: 0, cash: 0 })
  })
})

describe('in today’s budget', () => {
  const base: BudgetInputs = {
    expenses: [], annualExpenses: [],
    income: {
      taxMode: true, person1FTE: 100_000, person2FTE: 0, person1HasHELP: false, person2HasHELP: false,
      person1MonthlyNet: 0, person2MonthlyNet: 0,
    },
    childcare: { enabled: false, costPerDay: 0, daysPerWeek: 0, numChildren: 0 },
    rentMonthly: null, person1Days: 5, person2Days: 5, partnerEnabled: true,
  }

  it('adds the profit after tax to money in: 13,600 / 12 = 1,133.33 a month', () => {
    const off = computeBudgetSummary(base)
    const on = computeBudgetSummary({ ...base, business: { p1: 20_000, p2: 0 } })
    expect(on.businessMonthly).toBeCloseTo(1_133.33, 2)
    expect(on.monthlyIncome - off.monthlyIncome).toBeCloseTo(1_133.33, 2)
    expect(off.businessMonthly).toBe(0)
  })

  it('counts the profit in family income (the childcare subsidy test)', () => {
    expect(computeBudgetSummary({ ...base, business: { p1: 20_000, p2: 0 } }).familyIncome).toBe(120_000)
  })

  it('with HELP, takes the extra repayment too: (20,000 − 6,400 − 3,000) / 12', () => {
    const on = computeBudgetSummary({ ...base, income: { ...base.income, person1HasHELP: true }, business: { p1: 20_000, p2: 0 } })
    expect(on.businessMonthly).toBeCloseTo(10_600 / 12, 2)
  })

  it('for take-home-pay households, taxes it on top of the pay behind $5,000 a month', () => {
    // $60,000 take-home is about $74,000 before tax: 10,000 at 32% = 3,200.
    const s = computeBudgetSummary({ ...base, income: { ...base.income, taxMode: false, person1MonthlyNet: 5_000 }, business: { p1: 10_000, p2: 0 } })
    expect(s.businessMonthly).toBeCloseTo(6_800 / 12, 2)
  })

  it('ignores the partner’s business without a partner', () => {
    expect(computeBudgetSummary({ ...base, partnerEnabled: false, business: { p1: 0, p2: 20_000 } }).businessMonthly).toBe(0)
  })
})

describe('in the projection', () => {
  // Fixture: every dial at 0, two people on $120,000 (32% marginal), no loan.
  const base = makeProjectionInputs({ mortBalance: 0, mortPayment: 0, projYears: 2 })
  const off = runProjections(base).base

  it('without business income, nothing changes', () => {
    expect(off.businessArr).toEqual([0, 0])
    expect(off.businessProfitArr).toEqual([0, 0])
  })

  it('$10,000 profit on $120,000 pay is taxed at 32%: 6,800 more money in', () => {
    const on = runProjections({ ...base, business: [item({ amount: 10_000, startYear: FX_YEAR })] }).base
    expect(on.businessProfitArr[0]).toBe(10_000)
    expect(on.businessArr[0]).toBe(6_800)
    expect(on.incArr[0] - off.incArr[0]).toBe(6_800)
    expect(on.cashArr[0] - off.cashArr[0]).toBe(6_800)
    expect(moneyIn(on, true)[0] - moneyIn(off, true)[0]).toBe(6_800)
  })

  it('with HELP, $5,000 repays $750 more: the balance falls faster and less reaches cash', () => {
    // Repayment income 120,000 → 125,000, all in the 15c band: 5,000 × 15% = 750.
    const help = { person1HasHELP: true, person1HELPBalance: 50_000 }
    const offH = runProjections({ ...base, ...help }).base
    const onH = runProjections({ ...base, ...help, business: [item({ amount: 5_000, startYear: FX_YEAR })] }).base
    expect(onH.businessArr[0]).toBe(5_000 - 1_600 - 750)
    expect(offH.nwArr[0] - onH.nwArr[0]).toBe(-(5_000 - 1_600 - 750) - 750)
  })

  it('the partner’s business counts in their name', () => {
    const on = runProjections({ ...base, business: [item({ person: 'p2', amount: 10_000, startYear: FX_YEAR })] }).base
    expect(on.businessArr[0]).toBe(6_800)
  })
})

describe('bonuses (v14)', () => {
  const lc: LifeCourse = {
    partnerEnabled: false, person1Age: 40, person2Age: 40, person1RetirementAge: 67, person2RetirementAge: 67,
    person1Super: 0, person2Super: 0, person1ExtraSuper: 0, person2ExtraSuper: 0,
    sgRate: 0.12, superReturn: 0, superFeePct: 0, retirementSpending: 40_000, drawdown: 'need', drawdownPct: 6,
  }
  const base = makeProjectionInputs({ mortBalance: 0, mortPayment: 0, projYears: 2, lifeCourse: lc })
  const asBusiness = runProjections({ ...base, business: [item({ amount: 10_000, startYear: FX_YEAR })] }).base
  const asBonus = runProjections({ ...base, business: [item({ kind: 'bonus', amount: 10_000, startYear: FX_YEAR })] }).base

  it('are taxed like business profit: $10,000 on $120,000 pay leaves 6,800', () => {
    expect(asBonus.businessArr[0]).toBe(6_800)
    expect(asBonus.incArr[0]).toBe(asBusiness.incArr[0])
  })

  it('attract compulsory super: 12% of $10,000, less 15% contributions tax = 1,020 more a year', () => {
    expect(asBonus.superArr[0] - asBusiness.superArr[0]).toBe(1_020)
    expect(asBonus.superArr[1] - asBusiness.superArr[1]).toBe(2_040)
  })

  it('are counted by businessProfit only when asked for', () => {
    const items = [item({ amount: 5_000 }), item({ kind: 'bonus', amount: 3_000 })]
    expect(businessProfit(items, 'p1', 2027, 2027, true)).toBe(8_000)
    expect(businessProfit(items, 'p1', 2027, 2027, true, ['bonus'])).toBe(3_000)
  })
})

