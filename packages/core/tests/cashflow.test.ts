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
const budget = { monthlyIncome: 8_000, monthlyExpenses: 6_000 }

describe('cashflow, next 24 months', () => {
  const cf = computeCashflow({ budget, annualExpenses: bills, cashOnHand: 10_000, now: NOW })

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
    expect(cf.payChanges).toEqual([])
    expect(cf.months.every(m => m.income === 8_000 && !m.onLeave)).toBe(true)
  })

  it('says when cash runs out', () => {
    // 1,000 in the bank, 6,000 − 300 = 5,700 out and 5,600 in: −100 a month, and −1,200 in November.
    const tight = computeCashflow({ budget: { ...budget, monthlyIncome: 5_600 }, annualExpenses: bills, cashOnHand: 1_000, now: NOW })
    expect(tight.months[0].balance).toBe(1_000 - 100 - 1_200)
    expect(tight.runsOut?.label).toBe('Nov 26')
  })

  it('follows the plan: leave from July 2027 on Parental Leave Pay for six months, back at 3 days from January 2028', () => {
    // A made-up take-home: 5,000 for Person 1's full-time pay, plus 600 a day the partner works.
    const incomeFor = (d1: number, d2: number) => (d1 ? 5_000 : 0) + d2 * 600
    const plan = {
      phases: { p1: [{ year: 2026, days: 5 }], p2: [{ year: 2026, days: 5 }, { year: 2027, month: 7, days: 0 }, { year: 2028, month: 1, days: 3 }] },
      incomeFor, parentalLeave: true,
    }
    const lv = computeCashflow({ budget, annualExpenses: bills, cashOnHand: 10_000, plan, now: NOW })
    const ppl = calcAfterTax(PPL_TOTAL) / 6
    // Nov 2026 – Jun 2027: both full-time, 8,000. Jul – Dec 2027: 5,000 + PPL. From Jan 2028: 5,000 + 1,800.
    expect(lv.months[7]).toMatchObject({ label: 'Jun 27', income: 8_000, onLeave: false })
    expect(lv.months[8]).toMatchObject({ label: 'Jul 27', income: Math.round(5_000 + ppl), onLeave: true })
    expect(lv.months[13]).toMatchObject({ label: 'Dec 27', income: Math.round(5_000 + ppl), onLeave: true })
    expect(lv.months[14]).toMatchObject({ label: 'Jan 28', income: 6_800, onLeave: false })
    expect(lv.payChanges.map(c => c.label)).toEqual(['Jul 27', 'Jan 28'])
    // Cash in June 2027 matches the plain line; from July it follows the lower pay.
    expect(lv.months[7].balance).toBe(cf.months[7].balance)
    expect(lv.months[8].balance).toBe(Math.round(cf.months[7].balance + 5_000 + ppl - 5_700))
  })

  it('without parental leave switched on, 0 days is simply no pay', () => {
    const plan = { phases: { p1: [{ year: 2026, days: 5 }], p2: [{ year: 2027, month: 7, days: 0 }] }, incomeFor: (d1: number, d2: number) => d1 * 1_000 + d2 * 600, parentalLeave: false }
    const off = computeCashflow({ budget, annualExpenses: [], cashOnHand: 0, plan, now: NOW })
    expect(off.months[8]).toMatchObject({ income: 5_000, onLeave: false })
  })

  it('month labels are fixed English, whatever the locale', () => {
    expect(monthLabel(2027, 1)).toBe('Jan 27')
    expect(monthLabel(2030, 12)).toBe('Dec 30')
  })

  it('a January start rolls over the year correctly', () => {
    const jan = computeCashflow({ budget, annualExpenses: [], cashOnHand: 0, now: new Date(2026, 11, 31) })
    expect(jan.months[0].label).toBe('Jan 27')
    expect(jan.months[11].label).toBe('Dec 27')
  })
})
