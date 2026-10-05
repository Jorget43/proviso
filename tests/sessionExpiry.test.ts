import { describe, it, expect } from 'vitest'
import { sessionExpiry, needsRenewal, hashToken } from '@/lib/auth'

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

describe('app sessions', () => {
  it('last 30 days idle, 90 days at most', () => {
    expect(sessionExpiry(t0, created, 'app').getTime()).toBe(t0 + 30 * DAY)
    expect(sessionExpiry(t0 + 80 * DAY, created, 'app').getTime()).toBe(t0 + 90 * DAY)
  })

  it('renew daily against their own idle window', () => {
    const exp = new Date(t0 + 30 * DAY)
    expect(needsRenewal(t0 + 12 * 60 * 60 * 1000, exp, created, 'app')).toBe(false)
    expect(needsRenewal(t0 + DAY + 1, exp, created, 'app')).toBe(true)
  })
})

describe('hashToken', () => {
  it('stores a SHA-256, never the token', () => {
    const token = 'a'.repeat(64)
    const h = hashToken(token)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toBe(token)
    expect(hashToken(token)).toBe(h)
  })
})
