import { describe, it, expect } from 'vitest'
import { computeBudgetSummary, upcomingAnnualExpenses, type BudgetInputs } from '../src/budgetSummary'

const base: BudgetInputs = {
  expenses: [
    { id: 1, cat: 'Food', name: 'Groceries', freq: 'weekly', amt: 300 },     // 1300/mo
    { id: 2, cat: 'Home', name: 'Insurance', freq: 'yearly', amt: 1200 },    // 100/mo
  ],
  annualExpenses: [{ id: 1, cat: 'Transport', name: 'Rego', amt: 600, month: 3 }],  // 50/mo
  income: {
    taxMode: false, person1FTE: 0, person2FTE: 0, person1HasHELP: false, person2HasHELP: false,
    person1MonthlyNet: 5000, person2MonthlyNet: 3000,
  },
  childcare: { enabled: false, costPerDay: 0, daysPerWeek: 0, numChildren: 0 },
  rentMonthly: null,
  person1Days: 5, person2Days: 5,
  partnerEnabled: true,
}

describe('computeBudgetSummary', () => {
  it('amortises regular lines and annual bills into a monthly total', () => {
    const s = computeBudgetSummary(base)
    expect(s.monthlyIncome).toBe(8000)
    expect(s.monthlyExpenses).toBeCloseTo(1450, 6)   // 1300 + 100 + 50
    expect(s.delta).toBeCloseTo(6550, 6)
    expect(s.catMonthly.Transport).toBe(50)
  })

  it('ignores Person 2 income when there is no partner', () => {
    const s = computeBudgetSummary({ ...base, partnerEnabled: false })
    expect(s.monthlyIncome).toBe(5000)
    expect(s.person2Gross).toBe(0)
  })

  it('adds rent to Home when renting', () => {
    const s = computeBudgetSummary({ ...base, rentMonthly: 2000 })
    expect(s.catMonthly.Home).toBe(2100)
    expect(s.monthlyExpenses).toBeCloseTo(3450, 6)
  })

  it('hides the managed childcare line when childcare is off', () => {
    const s = computeBudgetSummary({
      ...base,
      expenses: [...base.expenses, { id: 9, cat: 'Children', name: 'Childcare', freq: 'monthly', amt: 999 }],
    })
    expect(s.childcareNet).toBeNull()
    expect(s.shownExpenses.some(e => e.name === 'Childcare')).toBe(false)
    expect(s.catMonthly.Children).toBe(0)
  })

  it('reports savings rate as a share of income', () => {
    const s = computeBudgetSummary({ ...base, income: { ...base.income, person1MonthlyNet: 1450, person2MonthlyNet: 0 } })
    expect(s.savingsRate).toBeCloseTo(0, 6)
  })
})

describe('upcomingAnnualExpenses', () => {
  const items = [
    { name: 'Rego', month: 11 },
    { name: 'Insurance', month: 1 },
    { name: 'Rates', month: 10 },
    { name: 'Holiday', month: 6 },
  ]

  it('returns bills due in the next three months, soonest first, wrapping the year', () => {
    const r = upcomingAnnualExpenses(items, new Date(2026, 9, 5))  // October
    expect(r.map(a => a.name)).toEqual(['Rates', 'Rego'])
    const dec = upcomingAnnualExpenses(items, new Date(2026, 11, 1))  // December
    expect(dec.map(a => [a.name, a.monthsAway])).toEqual([['Insurance', 1]])
  })
})
