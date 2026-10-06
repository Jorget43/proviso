import { describe, it, expect } from 'vitest'
import { computeMonthlyRepayment, monthsToRepay } from '../src/mortgage'

describe('monthsToRepay', () => {
  it('inverts the standard repayment', () => {
    const p = computeMonthlyRepayment(500_000, 6, 300)
    expect(monthsToRepay(500_000, 6, p)).toBe(300)
  })
  it('is shorter when paying more, and null when interest isn’t covered', () => {
    expect(monthsToRepay(500_000, 6, 4_000)!).toBeLessThan(300)
    expect(monthsToRepay(500_000, 6, 2_500)).toBeNull()
    expect(monthsToRepay(0, 6, 100)).toBe(0)
    expect(monthsToRepay(12_000, 0, 1_000)).toBe(12)
  })
})
