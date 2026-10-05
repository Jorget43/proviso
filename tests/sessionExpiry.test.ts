import { describe, it, expect } from 'vitest'
import { sessionExpiry, needsRenewal } from '@/lib/auth'

const DAY = 24 * 60 * 60 * 1000
const created = new Date('2026-10-01T00:00:00Z')
const t0 = created.getTime()

describe('sessionExpiry', () => {
  it('is 7 days from now while inside the 30-day cap', () => {
    expect(sessionExpiry(t0, created).getTime()).toBe(t0 + 7 * DAY)
    expect(sessionExpiry(t0 + 10 * DAY, created).getTime()).toBe(t0 + 17 * DAY)
  })

  it('never runs past 30 days after sign-in', () => {
    expect(sessionExpiry(t0 + 25 * DAY, created).getTime()).toBe(t0 + 30 * DAY)
  })
})

describe('needsRenewal', () => {
  it('waits a day before extending (no write on every request)', () => {
    const exp = new Date(t0 + 7 * DAY)
    expect(needsRenewal(t0 + 12 * 60 * 60 * 1000, exp, created)).toBe(false)
    expect(needsRenewal(t0 + DAY + 1, exp, created)).toBe(true)
  })

  it('stops once the expiry sits on the 30-day cap', () => {
    const atCap = new Date(t0 + 30 * DAY)
    expect(needsRenewal(t0 + 27 * DAY, atCap, created)).toBe(false)
  })

  it('clamps a pre-existing flat 30-day expiry down to the idle window', () => {
    const legacy = new Date(t0 + 30 * DAY)
    expect(needsRenewal(t0 + 60_000, legacy, created)).toBe(true)
    expect(sessionExpiry(t0 + 60_000, created).getTime()).toBe(t0 + 60_000 + 7 * DAY)
  })
})
