import { describe, it, expect } from 'vitest'
import { indexationDate, isPostIndexation, isInAlertWindow, computeHelpAlert } from '@/lib/help'

describe('indexationDate', () => {
  it('is 1 June of the FY-ending year', () => {
    const d = indexationDate(2025)
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(5) // June (0-indexed)
    expect(d.getDate()).toBe(1)
  })
})

describe('isPostIndexation', () => {
  it('is true on/after 1 June', () => {
    expect(isPostIndexation(2025, new Date(2025, 6, 1))).toBe(true)
  })
  it('is false before 1 June', () => {
    expect(isPostIndexation(2025, new Date(2025, 0, 1))).toBe(false)
  })
})

describe('isInAlertWindow', () => {
  it('is true within the 92-day window before indexation', () => {
    expect(isInAlertWindow(2025, new Date(2025, 3, 15))).toBe(true) // ~6 weeks out
  })
  it('is false once indexation has passed', () => {
    expect(isInAlertWindow(2025, new Date(2025, 6, 1))).toBe(false)
  })
  it('is false far ahead of the window', () => {
    expect(isInAlertWindow(2025, new Date(2024, 6, 1))).toBe(false)
  })
})

describe('computeHelpAlert', () => {
  it('nets voluntary repayments off the indexable base and values the saving', () => {
    const a = computeHelpAlert({
      member: 'Person 1',
      financialYearEnding: 2025,
      openingFyBalance: 20000,
      voluntaryRepayments: 5000,
      cpiRate: 4,
      grossIncome: 120000,
    })
    expect(a.indexableBase).toBe(15000)
    expect(a.increase).toBeCloseTo(600, 6) // 15000 * 4%
    expect(a.saving).toBeCloseTo(600, 6)
    // pre-tax equivalent return = cpi / (1 - marginal). marginal(120k)=0.32
    expect(a.preTaxEquivReturn).toBeCloseTo(4 / (1 - 0.32), 6)
  })

  it('floors the indexable base at zero when repayments exceed the balance', () => {
    const a = computeHelpAlert({
      member: 'Person 2',
      financialYearEnding: 2025,
      openingFyBalance: 3000,
      voluntaryRepayments: 5000,
      cpiRate: 4,
      grossIncome: 90000,
    })
    expect(a.indexableBase).toBe(0)
    expect(a.increase).toBe(0)
  })
})
