import { describe, it, expect } from 'vitest'
import { computeHomeOverview, type OverviewInputs } from '../src/overview'
import { situationFrom, situationLabels } from '../src/situation'

type E = { id: string; cat: string; name: string; freq: string; amt: number }

// October, outside tax season: no EOFY prompt unless a test asks for one.
const base = (over: Partial<OverviewInputs<E>> = {}): OverviewInputs<E> => ({
  now: new Date('2026-10-15T00:00:00Z'),
  expenses: [{ id: 'e1', cat: 'Groceries', name: 'Food', freq: 'monthly', amt: 2000 }],
  annualExpenses: [{ id: 'a1', cat: 'Transport', name: 'Car rego', amt: 1200, month: 11 }],
  income: { taxMode: false, person1FTE: 0, person2FTE: 0, person1HasHELP: false, person2HasHELP: false, person1MonthlyNet: 6000, person2MonthlyNet: 0 },
  childcare: { enabled: false, costPerDay: 0, daysPerWeek: 0, numChildren: 0 },
  rentMonthly: null,
  workPhases: { p1: [], p2: [] },
  partnerEnabled: false,
  assets: [{ name: 'Savings', amt: 30000, isOffset: true }],
  debts: [],
  mortgage: null,
  superBalances: { p1: 100000, p2: 50000 },
  snapshots: [],
  ...over,
})

describe('computeHomeOverview', () => {
  it('works out what’s left each month, with yearly bills spread out', () => {
    const o = computeHomeOverview(base())
    // 6000 − (2000 + 1200/12) = 3900
    expect(o.left).toBeCloseTo(3900)
    expect(o.coverMonths).toBeCloseTo(30000 / 2100)
    expect(o.checks).toEqual([])
    expect(o.upcoming.map(u => [u.name, u.monthsAway])).toEqual([['Car rego', 1]])
  })

  it('asks for income first, then flags a shortfall', () => {
    const none = computeHomeOverview(base({ income: { ...base().income, person1MonthlyNet: 0 } }))
    expect(none.noIncome).toBe(true)
    expect(none.checks[0]).toMatchObject({ tone: 'blue', target: 'income', cta: 'Add income' })
    const short = computeHomeOverview(base({ income: { ...base().income, person1MonthlyNet: 1600 } }))
    expect(short.checks[0]).toMatchObject({ tone: 'red', text: 'You\'re spending $500 more than you bring in each month.' })
  })

  it('flags a thin safety net and tax season', () => {
    const o = computeHomeOverview(base({ assets: [{ name: 'Savings', amt: 1000, isOffset: true }], now: new Date('2026-06-01T00:00:00Z') }))
    expect(o.checks.map(c => c.target)).toEqual(['savings', 'eofy'])
    expect(o.checks[0].text).toMatch(/less than a month/)
  })

  it('counts the partner’s super only with a partner', () => {
    expect(computeHomeOverview(base()).superTotal).toBe(100000)
    expect(computeHomeOverview(base({ partnerEnabled: true })).superTotal).toBe(150000)
  })

  it('shows the home loan unless renting or tracked as a debt row', () => {
    const mortgage = { balance: 400000, endDate: '2050-06' }
    expect(computeHomeOverview(base({ mortgage })).mortgageLeft).toBe(400000)
    expect(computeHomeOverview(base({ mortgage })).mortgageEndYear).toBe(2050)
    expect(computeHomeOverview(base({ mortgage, rentMonthly: 2000 })).mortgageLeft).toBeNull()
    expect(computeHomeOverview(base({ mortgage, debts: [{ name: 'Mortgage', amt: 400000 }] })).mortgageLeft).toBeNull()
  })

  it('compares net worth only with snapshots under the current definition', () => {
    const snap = (takenAt: string, netWorth: number) => ({ takenAt, netWorth, totalAssets: 1, totalDebts: 0 })
    // Before 2026-10-06 (old definition) — ignored.
    expect(computeHomeOverview(base({ snapshots: [snap('2026-09-01T00:00:00Z', 10000)] })).netWorthChange).toBeNull()
    const o = computeHomeOverview(base({ snapshots: [snap('2026-10-10T00:00:00Z', 25000), snap('2026-10-12T00:00:00Z', 28000)] }))
    expect(o.netWorthChange?.amount).toBe(5000)  // 30000 − the oldest eligible, 25000
  })
})

describe('situation', () => {
  it('needs a partner for parental leave, and renting for buying', () => {
    const s = situationFrom({ partnerEnabled: false, rent: { enabled: false, purchasePlanEnabled: true }, projection: { schoolFeesOn: true, parentalLeaveEnabled: true } })
    expect(s).toMatchObject({ parentalLeave: false, buying: false, schoolFees: true })
    expect(situationLabels(s, 'Sam')).toEqual(['Just me', 'Own our home', 'Planning school fees'])
  })

  it('treats missing settings as off', () => {
    expect(situationLabels(situationFrom({}), 'Sam')).toEqual(['Just me', 'Own our home'])
  })
})
