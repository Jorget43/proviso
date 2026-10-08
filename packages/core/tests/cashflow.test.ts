import { describe, it, expect } from 'vitest'
import { computeCashflow, monthLabel } from '../src/cashflow'
import { calcAfterTax } from '../src/tax'
import { PPL_TOTAL } from '../src/constants'

const NOW = new Date(2026, 9, 15)   // 15 Oct 2026
const bills = [
  { name: 'Car rego', amt: 1_200, month: 11 },
  { name: 'Home insurance', amt: 2_400, month: 3 },
]
// Budget figures as computeBudgetSummary gives them: $8,000 in, $6,000 out a
// month, of which $300 is the two yearly bills spread ((1,200 + 2,400) / 12).
const budget = { monthlyIncome: 8_000, monthlyExpenses: 6_000, person1Net: 5_000 }

describe('cashflow, next 24 months', () => {
  const cf = computeCashflow({ budget, annualExpenses: bills, cashOnHand: 10_000, parentalLeave: false, now: NOW })

  it('regular spending leaves the yearly bills out; they land in their own month', () => {
    // 6,000 − 300 = 5,700 regular; 8,000 − 5,700 = 2,300 surplus each month.
    expect(cf.monthlyOut).toBe(5_700)
    expect(cf.monthlySurplus).toBe(2_300)
    expect(cf.months).toHaveLength(24)
    // Month 1 is November 2026: 10,000 + 2,300 − 1,200 (rego) = 11,100.
    expect(cf.months[0]).toMatchObject({ label: 'Nov 26', year: 2026, month: 11, billsTotal: 1_200, balance: 11_100 })
    expect(cf.months[0].bills).toEqual([{ name: 'Car rego', amt: 1_200 }])
    // December: 10,000 + 4,600 − 1,200 = 13,400 (the rego stays paid).
    expect(cf.months[1].balance).toBe(13_400)
    // March 2027 (month 5): 10,000 + 11,500 − 3,600 = 17,900.
    expect(cf.months[4]).toMatchObject({ label: 'Mar 27', balance: 17_900 })
  })

  it('over a whole year it ends where Home’s “left over” says', () => {
    // October 2027 (month 12): 10,000 + 27,600 − 3,600 = 34,000 = 10,000 + 12 × (8,000 − 6,000).
    expect(cf.months[11]).toMatchObject({ label: 'Oct 27', balance: 34_000 })
    // October 2028: 10,000 + 55,200 − 7,200 = 58,000.
    expect(cf.months[23].balance).toBe(58_000)
  })

  it('finds the lowest month; doesn’t run out', () => {
    expect(cf.lowest.label).toBe('Nov 26')
    expect(cf.runsOut).toBeNull()
    expect(cf.leave).toBeNull()
    expect(cf.months.every(m => m.leaveBalance === null)).toBe(true)
  })

  it('says when cash runs out', () => {
    // 1,000 in the bank, 6,000 − 300 = 5,700 out and 5,600 in: −100 a month, and −1,200 in November.
    const tight = computeCashflow({ budget: { ...budget, monthlyIncome: 5_600 }, annualExpenses: bills, cashOnHand: 1_000, parentalLeave: false, now: NOW })
    expect(tight.months[0].balance).toBe(1_000 - 100 - 1_200)
    expect(tight.runsOut?.label).toBe('Nov 26')
  })

  it('parental leave: Parental Leave Pay (after tax) for six months, then one income', () => {
    const lv = computeCashflow({ budget, annualExpenses: bills, cashOnHand: 10_000, parentalLeave: true, now: NOW })
    const ppl = calcAfterTax(PPL_TOTAL) / 6
    expect(lv.leave!.onPplSurplus).toBeCloseTo(5_000 + ppl - 5_700, 6)
    expect(lv.leave!.afterPplSurplus).toBe(-700)
    expect(lv.leave!.runwayMonths).toBeCloseTo(10_000 / 700, 6)
    // May 2027 (month 7): six months on PPL, one after, both bills paid.
    expect(lv.months[6].leaveBalance).toBe(Math.round(10_000 + 6 * (5_000 + ppl - 5_700) - 700 - 3_600))
    // The both-working line is unchanged.
    expect(lv.months[6].balance).toBe(cf.months[6].balance)
  })

  it('month labels are fixed English, whatever the locale', () => {
    expect(monthLabel(2027, 1)).toBe('Jan 27')
    expect(monthLabel(2030, 12)).toBe('Dec 30')
  })

  it('a January start rolls over the year correctly', () => {
    const jan = computeCashflow({ budget, annualExpenses: [], cashOnHand: 0, parentalLeave: false, now: new Date(2026, 11, 31) })
    expect(jan.months[0].label).toBe('Jan 27')
    expect(jan.months[11].label).toBe('Dec 27')
  })
})
