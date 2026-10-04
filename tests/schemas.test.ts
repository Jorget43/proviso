import { describe, it, expect } from 'vitest'
import {
  childcareSettingsSchema, actualsSettingsSchema, rentSettingsSchema, superSettingsSchema,
  pocketMoneySchema, userUpdateSchema, onboardingSchema, annualExpenseSchema, donationSchema, householdNamesSchema,
} from '@/lib/schemas'
import { parseBody, ApiError } from '@/lib/apiHandler'

const req = (body: unknown) => new Request('http://x', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })

describe('settings schemas strip fields that must not be writable', () => {
  it('drops id and unknown keys (no mass assignment)', () => {
    expect(childcareSettingsSchema.parse({ id: 99, enabled: true, evil: 1 })).toEqual({ enabled: true })
    expect(actualsSettingsSchema.parse({ id: 5, useActualsProjections: true })).toEqual({ useActualsProjections: true })
  })

  it('rent settings are partial — an omitted field is not reset', () => {
    expect(rentSettingsSchema.parse({ monthlyRent: 2000 })).toEqual({ monthlyRent: 2000 })
  })
})

describe('range checks', () => {
  it('rejects implausible values', () => {
    expect(superSettingsSchema.safeParse({ sgRate: 12 }).success).toBe(false)      // decimal, not percent
    expect(superSettingsSchema.safeParse({ sgRate: 0.12 }).success).toBe(true)
    expect(annualExpenseSchema.safeParse({ name: 'Rego', cat: 'Transport', amt: 900, month: 13 }).success).toBe(false)
    expect(rentSettingsSchema.safeParse({ depositPct: 120 }).success).toBe(false)
    expect(childcareSettingsSchema.safeParse({ daysPerWeek: 6 }).success).toBe(false)
  })

  it('rejects negative money and non-finite numbers', () => {
    expect(annualExpenseSchema.safeParse({ name: 'x', cat: 'y', amt: -1, month: 1 }).success).toBe(false)
    expect(donationSchema.safeParse({ charity: 'x', amount: Infinity, date: '2026-01-01', financialYr: 2026 }).success).toBe(false)
  })

  it('requires ISO dates', () => {
    expect(donationSchema.safeParse({ charity: 'x', amount: 5, date: '01/02/2026', financialYr: 2026 }).success).toBe(false)
  })

  it('pocket money must be non-zero', () => {
    expect(pocketMoneySchema.safeParse({ amount: 0, description: 'x', date: '2026-01-01' }).success).toBe(false)
  })

  it('email may be cleared but must otherwise be valid', () => {
    expect(userUpdateSchema.safeParse({ email: '' }).success).toBe(true)
    expect(userUpdateSchema.safeParse({ email: null }).success).toBe(true)
    expect(userUpdateSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })

  it('onboarding rejects fractional ages and bad dates', () => {
    const ok = {
      person1Name: 'A', person1Age: 30, person1Income: 1, person1HasHELP: false, person1HELPBalance: 0, person1Days: 5,
      hasPartner: false, person2Name: 'B', person2Age: 0, person2Income: 0, person2HasHELP: false, person2HELPBalance: 0, person2Days: 5,
      person1Super: 0, person2Super: 0, sharesValue: 0, cryptoValue: 0, otherInvestments: 0, cashBalance: 0,
      hasMortgage: false, mortgageBalance: 0, mortgageRate: 0, mortgageEndDate: '', hasParentalLeave: false,
    }
    expect(onboardingSchema.safeParse(ok).success).toBe(true)
    expect(onboardingSchema.safeParse({ ...ok, person1Age: 30.5 }).success).toBe(false)
    expect(onboardingSchema.safeParse({ ...ok, mortgageEndDate: 'soon' }).success).toBe(false)
  })
})

describe('parseBody', () => {
  it('turns malformed JSON into a 400, not a 500', async () => {
    await expect(parseBody(req('{not json'), donationSchema)).rejects.toMatchObject({ status: 400 })
  })

  it("names the failing field and keeps a custom message", async () => {
    const err = await parseBody(req({ charity: 'x', amount: 5, date: 'bad', financialYr: 2026 }), donationSchema).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBe('Date: Expected YYYY-MM-DD')
  })

  it('rewrites range errors in plain language', async () => {
    const err = await parseBody(req({ charity: 'x', amount: -5, date: '2026-01-01', financialYr: 2026 }), donationSchema).catch(e => e)
    expect(err.message).toBe('Amount must be at least 0')
  })

  it('says which field is empty or missing', async () => {
    const err = await parseBody(req({ charity: '', amount: 5, date: '2026-01-01', financialYr: 2026 }), donationSchema).catch(e => e)
    expect(err.message).toBe('Charity can’t be empty')
    const missing = await parseBody(req({ amount: 5, date: '2026-01-01', financialYr: 2026 }), donationSchema).catch(e => e)
    expect(missing.message).toBe('Charity is required')
  })

  it('labels fields containing digits readably', async () => {
    const err = await parseBody(req({ person1Name: '  ' }), householdNamesSchema).catch(e => e)
    expect(err.message).toBe('Person 1 name can’t be empty')
  })

  it('uses the caller-supplied message when given', async () => {
    const err = await parseBody(req({}), donationSchema, 'Fill in the form').catch(e => e)
    expect(err.message).toBe('Fill in the form')
  })
})
