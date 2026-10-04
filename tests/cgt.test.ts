import { describe, it, expect } from 'vitest'
import { computeCgt, heldAtLeast12Months } from '@/lib/cgt'

describe('heldAtLeast12Months', () => {
  it('is true once a full year has elapsed', () => {
    expect(heldAtLeast12Months('2020-01-01', new Date('2021-06-01'))).toBe(true)
    expect(heldAtLeast12Months('2020-01-01', new Date('2021-01-01'))).toBe(true)
  })
  it('is false before a year', () => {
    expect(heldAtLeast12Months('2020-01-01', new Date('2020-06-01'))).toBe(false)
  })
  it('is false for an unparseable date', () => {
    expect(heldAtLeast12Months('not-a-date', new Date('2025-01-01'))).toBe(false)
  })
})

describe('computeCgt', () => {
  const base = { quantity: 100, purchasePrice: 10, currentPrice: 20, marginalRate: 0.32 }

  it('applies the 50% discount when held ≥ 12 months on a gain', () => {
    const r = computeCgt({ ...base, purchaseDate: '2020-01-01', asOf: new Date('2025-01-01') })
    expect(r.costBase).toBe(1000)
    expect(r.marketValue).toBe(2000)
    expect(r.capitalGain).toBe(1000)
    expect(r.discountEligible).toBe(true)
    expect(r.discountableGain).toBeCloseTo(500, 6)
    expect(r.estimatedCgt).toBeCloseTo(160, 6)
    expect(r.netProceeds).toBeCloseTo(1840, 6)
  })

  it('does NOT discount a short-held gain', () => {
    const r = computeCgt({ ...base, purchaseDate: '2024-08-01', asOf: new Date('2025-01-01') })
    expect(r.discountEligible).toBe(false)
    expect(r.discountableGain).toBeCloseTo(1000, 6)
    expect(r.estimatedCgt).toBeCloseTo(320, 6)
  })

  it('charges no CGT on a capital loss', () => {
    const r = computeCgt({ ...base, currentPrice: 5, purchaseDate: '2020-01-01', asOf: new Date('2025-01-01') })
    expect(r.isLoss).toBe(true)
    expect(r.capitalGain).toBe(-500)
    expect(r.estimatedCgt).toBe(0)
    expect(r.netProceeds).toBe(500)
  })
})
