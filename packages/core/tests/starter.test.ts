import { describe, it, expect } from 'vitest'
import {
  estimateLivingCosts, buildStarterHousehold, locationKey, typicalSuper, typicalChildcareDay,
  type StarterAnswers, type StarterPerson,
} from '../src/starter'
import { toMonthly } from '../src/formatting'
import { CATS } from '../src/constants'
import { isManagedChildcare } from '../src/budgetSummary'

const person = (over: Partial<StarterPerson> = {}): StarterPerson => ({
  name: 'Alex', age: 35, salary: 100_000, days: 5, hasHelp: false, helpBalance: 0, superBalance: 60_000, ...over,
})

const base = (over: Partial<StarterAnswers> = {}): StarterAnswers => ({
  state: 'vic', regional: false, you: person(), partner: null, children: [], schoolType: null,
  home: { kind: 'rent', weeklyRent: 550, mortgageBalance: 0, mortgageRate: 6.2, mortgageYears: 25 },
  cars: 1, cash: 20_000, investments: 0, ...over,
})

const monthly = (a: StarterAnswers) => estimateLivingCosts(a).reduce((s, l) => s + toMonthly(l.amt, l.freq), 0)
const names = (a: StarterAnswers) => estimateLivingCosts(a).map(l => l.name)

describe('estimateLivingCosts', () => {
  it('gives every line a known category, a positive amount and a unique key', () => {
    const a = base({ partner: person({ name: 'Sam' }), children: [{ age: 1, childcareDays: 3 }, { age: 8, childcareDays: 0 }], schoolType: 'catholic', home: { kind: 'mortgage', weeklyRent: 0, mortgageBalance: 600_000, mortgageRate: 6.2, mortgageYears: 25 }, cars: 2 })
    const lines = estimateLivingCosts(a)
    expect(lines.length).toBeGreaterThan(15)
    for (const l of lines) {
      expect((CATS as readonly string[])).toContain(l.cat)
      expect(l.amt).toBeGreaterThan(0)
    }
    expect(new Set(lines.map(l => l.key)).size).toBe(lines.length)
  })

  it('costs more for a bigger household', () => {
    const single = monthly(base())
    const couple = monthly(base({ partner: person({ name: 'Sam' }) }))
    const family = monthly(base({ partner: person({ name: 'Sam' }), children: [{ age: 6, childcareDays: 0 }, { age: 9, childcareDays: 0 }], schoolType: 'government' }))
    expect(couple).toBeGreaterThan(single)
    expect(family).toBeGreaterThan(couple)
  })

  it('lands in a sensible range: a single renter in Melbourne spends $2–4k a month before rent', () => {
    const m = monthly(base())
    expect(m).toBeGreaterThan(2000)
    expect(m).toBeLessThan(4000)
  })

  it('adds owners’ costs and the repayment for a mortgage, renters’ costs for renting', () => {
    const owner = estimateLivingCosts(base({ home: { kind: 'mortgage', weeklyRent: 0, mortgageBalance: 500_000, mortgageRate: 6, mortgageYears: 25 } }))
    expect(owner.map(l => l.name)).toEqual(expect.arrayContaining(['Mortgage', 'Council rates', 'Home & contents insurance']))
    // $500k over 25 years at 6% ≈ $3,222 a month
    expect(owner.find(l => l.name === 'Mortgage')!.amt).toBe(3222)
    const renter = names(base())
    expect(renter).toContain('Contents insurance')
    expect(renter).not.toContain('Council rates')
    expect(renter).not.toContain('Mortgage')   // rent itself lives in rent settings, not a line
  })

  it('without a car: public transport, no car costs', () => {
    const n = names(base({ cars: 0 }))
    expect(n).toContain('Public transport')
    expect(n.some(x => /Fuel|rego|Car insurance/.test(x))).toBe(false)
  })

  it('charges tolls only in the capitals that have them', () => {
    expect(names(base({ state: 'nsw' }))).toContain('Tolls & parking')
    expect(names(base({ state: 'nsw', regional: true }))).not.toContain('Tolls & parking')
    expect(names(base({ state: 'sa' }))).not.toContain('Tolls & parking')
  })

  it('prices school by the location and school type, per child at their year level', () => {
    const kids = [{ age: 10, childcareDays: 0 }]
    const gov = estimateLivingCosts(base({ children: kids, schoolType: 'government' })).find(l => l.name.startsWith('School costs'))!
    const ind = estimateLivingCosts(base({ children: kids, schoolType: 'independent' })).find(l => l.name.startsWith('School costs'))!
    expect(gov.freq).toBe('yearly')
    expect(ind.amt).toBeGreaterThan(gov.amt)
    // Regional schools cost less than Melbourne's
    const reg = estimateLivingCosts(base({ regional: true, children: kids, schoolType: 'independent' })).find(l => l.name.startsWith('School costs'))!
    expect(reg.amt).toBeLessThan(ind.amt)
  })

  it('numbers children eldest first', () => {
    const n = names(base({ children: [{ age: 1, childcareDays: 0 }, { age: 7, childcareDays: 0 }], schoolType: 'government' }))
    expect(n.find(x => x.includes('baby things'))).toContain('Child 2 (age 1)')
    expect(n.find(x => x.startsWith('School costs'))).toContain('Child 1 (age 7)')
  })
})

describe('buildStarterHousehold', () => {
  const now = new Date(2026, 9, 6)

  it('carries people, pay, super and HELP across', () => {
    const a = base({ you: person({ hasHelp: true, helpBalance: 20_000 }), partner: person({ name: 'Sam', salary: 80_000, days: 3, superBalance: 40_000 }) })
    const h = buildStarterHousehold(a, estimateLivingCosts(a), now)
    expect(h.household).toEqual({ person1Name: 'Alex', person2Name: 'Sam', partnerEnabled: true, onboardingDone: true })
    expect(h.income).toMatchObject({ person1FTE: 100_000, person2FTE: 80_000, person1HasHELP: true, person2HasHELP: false })
    expect(h.workPhases).toEqual([{ person: 'p1', year: 2026, days: 5 }, { person: 'p2', year: 2026, days: 3 }])
    expect(h.super).toEqual({ person1Balance: 60_000, person2Balance: 40_000 })
    expect(h.debts).toEqual([{ name: 'Alex HELP debt', amt: 20_000 }])
  })

  it('uses the lines as the person left them', () => {
    const a = base()
    const lines = estimateLivingCosts(a).filter(l => l.name !== 'Streaming').map(l => l.name === 'Groceries' ? { ...l, amt: 999 } : l)
    const h = buildStarterHousehold(a, lines, now)
    expect(h.expenses.find(e => e.name === 'Groceries')!.amt).toBe(999)
    expect(h.expenses.some(e => e.name === 'Streaming')).toBe(false)
  })

  it('turns weekly rent into monthly rent settings', () => {
    const h = buildStarterHousehold(base(), [], now)
    expect(h.rent).toEqual({ enabled: true, monthlyRent: Math.round(550 * 52 / 12) })
    expect(h.mortgage).toBeNull()
  })

  it('sets up the mortgage, with cash as the offset', () => {
    const a = base({ home: { kind: 'mortgage', weeklyRent: 0, mortgageBalance: 500_000, mortgageRate: 6, mortgageYears: 25 } })
    const h = buildStarterHousehold(a, [], now)
    expect(h.mortgage).toEqual({ balance: 500_000, rate: 6, payment: 3222, offsetBal: 20_000, endDate: '2051-10-01' })
    expect(h.assets).toEqual([{ name: 'Cash / savings', amt: 20_000, isOffset: true }])
    expect(h.rent.enabled).toBe(false)
  })

  it('switches childcare on for children in care, with the managed line', () => {
    const a = base({ partner: person({ name: 'Sam' }), children: [{ age: 1, childcareDays: 3 }, { age: 3, childcareDays: 4 }, { age: 6, childcareDays: 0 }] })
    const h = buildStarterHousehold(a, [], now)
    expect(h.childcare).toEqual({ enabled: true, costPerDay: typicalChildcareDay('vic', false), daysPerWeek: 4, numChildren: 2 })
    expect(h.expenses.filter(isManagedChildcare)).toHaveLength(1)
    // No children in care: off, and no managed line
    const none = buildStarterHousehold(base(), [], now)
    expect(none.childcare.enabled).toBe(false)
    expect(none.expenses.filter(isManagedChildcare)).toHaveLength(0)
  })

  it('records the two eldest children’s school start years and the school preset', () => {
    const a = base({ children: [{ age: 2, childcareDays: 0 }, { age: 7, childcareDays: 0 }], schoolType: 'independent', regional: true })
    const h = buildStarterHousehold(a, [], now)
    // Fee schedules start at the pre-school year (age 4)
    expect(h.projection).toMatchObject({ sfC1Start: 2023, sfC2Start: 2028, sfPresetKey: 'vic_r|independent', schoolFeesOn: false, parentalLeaveEnabled: false })
  })
})

describe('suggestions', () => {
  it('location keys match the school presets', () => {
    expect(locationKey('vic', true)).toBe('vic_r')
    expect(locationKey('tas', true)).toBe('tas')
    expect(locationKey('nsw', false)).toBe('nsw')
  })

  it('typical super grows with age', () => {
    expect(typicalSuper(22)).toBeLessThan(typicalSuper(35))
    expect(typicalSuper(35)).toBeLessThan(typicalSuper(55))
  })
})
