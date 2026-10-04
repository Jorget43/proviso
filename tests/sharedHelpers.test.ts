import { describe, it, expect } from 'vitest'
import { workDaysForYear } from '@/lib/projections'
import { computeCashOnHand } from '@/lib/netWorth'
import { storePendingTotp, getPendingTotp, recordFailedTotp, consumePendingTotp } from '@/lib/totpPending'

describe('workDaysForYear', () => {
  it('defaults to full-time when there are no phases', () => {
    expect(workDaysForYear([], 2026)).toBe(5)
  })

  it('keeps a phase in force for later years until the next one starts', () => {
    // Regression: Budget/Cashflow/Debts used an exact-year match, so a phase
    // set in 2026 vanished on 1 Jan 2027 and Person 2 fell back to 3 days.
    const phases = [{ year: 2026, days: 4 }]
    expect(workDaysForYear(phases, 2027)).toBe(4)
    expect(workDaysForYear(phases, 2030)).toBe(4)
  })

  it('switches at the next phase and ignores input order', () => {
    const phases = [{ year: 2028, days: 0 }, { year: 2026, days: 3 }, { year: 2029, days: 5 }]
    expect(workDaysForYear(phases, 2027)).toBe(3)
    expect(workDaysForYear(phases, 2028)).toBe(0)
    expect(workDaysForYear(phases, 2029)).toBe(5)
  })
})

describe('computeCashOnHand', () => {
  it('sums offset-flagged accounts', () => {
    const assets = [
      { name: 'Offset account', amt: 20000, isOffset: true },
      { name: 'Savings', amt: 5000, isOffset: true },
      { name: 'Cash jar', amt: 999, isOffset: false },
    ]
    expect(computeCashOnHand(assets)).toBe(25000)
  })

  it('falls back to a cash-named asset when nothing is flagged', () => {
    expect(computeCashOnHand([{ name: 'Cash / savings', amt: 8000, isOffset: false }])).toBe(8000)
    expect(computeCashOnHand([{ name: 'Shares', amt: 8000, isOffset: false }])).toBe(0)
  })
})

describe('pending TOTP login', () => {
  it('survives a wrong code so the user can retry', () => {
    const nonce = storePendingTotp(7)
    expect(recordFailedTotp(nonce)).toBe(true)
    expect(getPendingTotp(nonce)).toBe(7)
  })

  it('is dropped after five wrong codes', () => {
    const nonce = storePendingTotp(7)
    for (let i = 0; i < 4; i++) expect(recordFailedTotp(nonce)).toBe(true)
    expect(recordFailedTotp(nonce)).toBe(false)
    expect(getPendingTotp(nonce)).toBeNull()
  })

  it('is single-use once consumed', () => {
    const nonce = storePendingTotp(7)
    consumePendingTotp(nonce)
    expect(getPendingTotp(nonce)).toBeNull()
  })
})
