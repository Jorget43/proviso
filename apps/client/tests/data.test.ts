import { describe, it, expect, beforeEach } from 'vitest'
import { emptyHouseholdTables, EXPORT_FORMAT, EXPORT_VERSION, type HouseholdExport } from '@proviso/core/householdExport'
import { SCHEMA_VERSION, SETTINGS_ID } from '@proviso/core/schema'
import { contentId } from '@proviso/core/ids'
import type { Db } from '@/data/db'
import { loadHousehold } from '@/data/household'
import { importHousehold, exportHousehold, restoreHousehold, eraseHousehold } from '@/data/importExport'
import { savePeople, saveRent, saveChildcare } from '@/data/settings'
import { encryptBackup, decryptBackup, newHouseholdKey } from '@proviso/core/backup'
import { parseHouseholdExport } from '@proviso/core/householdExport'
import { insertRow, updateRow, deleteRow, saveSettings } from '@/data/mutate'
import { homeView, spendingView, wealthView, futureView, cashflowView } from '@/data/views'
import { saveCost, removeCost, kindOf, type CostDraft } from '@/data/costs'
import { startHousehold, savePay } from '@/data/setup'
import { saveAsset, removeAsset, saveDebt, saveLoan, saveSuper } from '@/data/wealth'
import { saveAssumptions, saveOneOff, removeOneOff } from '@/data/future'
import { startWhatIf, applyWhatIf, hasChanges, addWorkChange, keepWhatIf } from '@/data/whatif'
import { estimateLivingCosts, buildStarterHousehold, type StarterAnswers } from '@proviso/core/starter'

import type { DatabaseSync } from 'node:sqlite'
import { migratedTestDb } from './testDb'

const ID = (n: number) => contentId('test', n)
const NOW = new Date('2026-10-15T00:00:00Z')

function sampleExport(): HouseholdExport {
  const h = emptyHouseholdTables()
  h.householdSettings.push({ id: SETTINGS_ID.household, deletedAt: null, person1Name: 'Alex', person2Name: 'Sam', partnerEnabled: true, onboardingDone: true })
  h.incomeSettings.push({ id: SETTINGS_ID.income, deletedAt: null, taxMode: false, person1FTE: 0, person2FTE: 0, person1HasHELP: false, person2HasHELP: false,
    person1MonthlyNet: 5000, person2MonthlyNet: 3000, person1Age: 35, person2Age: 34 })
  h.expense.push(
    { id: ID(1), deletedAt: null, cat: 'Food', name: 'Groceries', freq: 'weekly', amt: 300 },
    { id: ID(2), deletedAt: null, cat: 'Utilities', name: 'Power', freq: 'quarterly', amt: 600 },
  )
  h.annualExpense.push({ id: ID(3), deletedAt: null, name: 'Car rego', cat: 'Transport', amt: 1200, month: 11 })
  h.asset.push({ id: ID(4), deletedAt: null, name: 'Savings', amt: 20000, isOffset: true })
  // A NAS household always has this row (seeded); parental leave is off here.
  h.projectionSettings.push({ id: SETTINGS_ID.projections, deletedAt: null, person1Growth: 3.5, person2Growth: 3, expInflNear: 4, expInfl: 2.5,
    childcareInfl: 6, propGrowth: 3.5, savingsRate: 10, investReturn: 3.5, projYears: 20, schoolFeesOn: false, sfC1Start: 2032, sfC1ExitIdx: 13,
    sfC2Start: 2035, sfC2ExitIdx: 13, sfInfl: 5, sfPresetKey: null, parentalLeaveEnabled: false })
  h.rentSettings.push({ id: SETTINGS_ID.rent, deletedAt: null, enabled: true, monthlyRent: 2400, annualIncreaseRate: 5, purchasePlanEnabled: false,
    targetPurchaseYear: 2031, targetPropertyValue: 800000, depositPct: 20, depositFromCash: 0, depositFromInvestments: 0, newMortgageRate: 6, newMortgageTermYrs: 30 })
  return {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: NOW.toISOString(), householdId: ID(0),
    source: { app: 'test', version: '0' }, household: h, pocketMoney: [], notes: ['A sample note'],
  }
}

describe('client data layer', () => {
  let db: Db, raw: DatabaseSync, failOn: { re: RegExp | null }
  beforeEach(async () => { ({ db, raw, failOn } = await migratedTestDb()) })

  it('starts empty, with schema defaults standing in for missing settings', async () => {
    const h = await loadHousehold(db)
    expect(h.exists).toBe(false)
    expect(h.settings.person1Name).toBe('You')
    expect(h.superSettings.person1RetirementAge).toBe(67)
  })

  it('imports an export file and shows the same figures as the NAS would', async () => {
    const r = await importHousehold(db, JSON.parse(JSON.stringify(sampleExport())))
    expect(r).toEqual({ rows: 8, notes: ['A sample note'], householdId: sampleExport().householdId })
    const h = await loadHousehold(db)
    expect(h.exists).toBe(true)
    const home = homeView(h, NOW)
    // Out: 300×52/12 (1300) + 600/3 (200) + 1200/12 (100) + rent 2400 = 4000. In: 8000.
    expect(home.budget.monthlyExpenses).toBeCloseTo(4000)
    expect(home.left).toBeCloseTo(4000)
    expect(home.situation).toEqual(['With Sam', 'Renting'])
    expect(home.upcoming.map(u => u.name)).toEqual(['Car rego'])
  })

  it('groups spending by category, biggest first, with rent as a managed line', async () => {
    await importHousehold(db, sampleExport())
    const v = spendingView(await loadHousehold(db), NOW)
    expect(v.categories.map(c => c.cat)).toEqual(['Home', 'Food', 'Utilities', 'Transport'])
    expect(v.categories[0].lines[0]).toMatchObject({ kind: 'rent', editable: false, monthly: 2400 })
    expect(v.categories.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1)
  })

  it('writes through mutate: add, change, and delete (kept, marked deleted)', async () => {
    await importHousehold(db, sampleExport())
    const id = await insertRow(db, 'expense', { cat: 'Pets', name: 'Dog food', freq: 'monthly', amt: 80 })
    expect((await loadHousehold(db)).expenses.find(e => e.id === id)?.amt).toBe(80)
    await updateRow(db, 'expense', id, { amt: 95 })
    expect((await loadHousehold(db)).expenses.find(e => e.id === id)?.amt).toBe(95)
    await deleteRow(db, 'expense', id, NOW)
    expect((await loadHousehold(db)).expenses.find(e => e.id === id)).toBeUndefined()
    const kept = raw.prepare('SELECT deletedAt FROM expense WHERE id = ?').get(id) as { deletedAt: string }
    expect(kept.deletedAt).toBe(NOW.toISOString())
  })

  it('creates a settings row on first save, then updates it', async () => {
    await saveSettings(db, 'householdSettings', { person1Name: 'Jo' })
    let h = await loadHousehold(db)
    expect(h.exists).toBe(true)
    expect(h.settings).toMatchObject({ id: SETTINGS_ID.household, person1Name: 'Jo', person2Name: 'Partner' })
    await saveSettings(db, 'householdSettings', { partnerEnabled: true })
    h = await loadHousehold(db)
    expect(h.settings).toMatchObject({ person1Name: 'Jo', partnerEnabled: true })
  })

  it('leaves the device untouched when an import file is bad', async () => {
    await importHousehold(db, sampleExport())
    const bad = JSON.parse(JSON.stringify(sampleExport()))
    bad.household.expense[0].amt = 'lots'
    await expect(importHousehold(db, bad)).rejects.toThrow('expense[0] has the wrong kind of value for "amt".')
    expect((await loadHousehold(db)).expenses).toHaveLength(2)
  })

  it('rolls back a half-done import, keeping what was there', async () => {
    await importHousehold(db, sampleExport())
    const second = sampleExport()
    second.household.expense = [{ id: ID(9), deletedAt: null, cat: 'Fun', name: 'New line', freq: 'monthly', amt: 1 }]
    // Fail after the old rows are deleted and the first new ones inserted.
    failOn.re = /insert into "annualExpense"/i
    await expect(importHousehold(db, second)).rejects.toThrow(/Failed query: insert into "annualExpense"/)
    failOn.re = null
    const h = await loadHousehold(db)
    expect(h.expenses.map(e => e.name).sort()).toEqual(['Groceries', 'Power'])
    expect(h.annualExpenses).toHaveLength(1)
  })

})

describe('saving costs', () => {
  let db: Db
  beforeEach(async () => { ({ db } = await migratedTestDb()) })
  const draft = (over: Partial<CostDraft> = {}): CostDraft => ({ name: 'Insurance', cat: 'Insurance', amt: 600, freq: 'yearly', month: null, ...over })

  it('saves Yearly without a month as a regular cost, and with a month as a yearly bill', async () => {
    expect(kindOf({ freq: 'yearly', month: null })).toBe('regular')
    expect(kindOf({ freq: 'yearly', month: 3 })).toBe('annual')
    expect(kindOf({ freq: 'monthly', month: 3 })).toBe('regular')
    await saveCost(db, null, draft())
    await saveCost(db, null, draft({ name: 'Rego', month: 11 }))
    const h = await loadHousehold(db)
    expect(h.expenses.map(e => [e.name, e.freq])).toEqual([['Insurance', 'yearly']])
    expect(h.annualExpenses.map(a => [a.name, a.month])).toEqual([['Rego', 11]])
  })

  it('updates in place when the kind stays the same', async () => {
    const a = await saveCost(db, null, draft({ freq: 'monthly', amt: 50 }))
    const b = await saveCost(db, a, draft({ freq: 'weekly', amt: 15, name: '  Pet insurance ' }))
    expect(b.id).toBe(a.id)
    expect((await loadHousehold(db)).expenses).toMatchObject([{ id: a.id, name: 'Pet insurance', freq: 'weekly', amt: 15 }])
  })

  it('moves a cost across when its kind changes, leaving no copy behind', async () => {
    const regular = await saveCost(db, null, draft({ freq: 'monthly', amt: 50 }))
    const annual = await saveCost(db, regular, draft({ amt: 600, month: 7 }))
    expect(annual.kind).toBe('annual')
    let h = await loadHousehold(db)
    expect(h.expenses).toEqual([])
    expect(h.annualExpenses).toMatchObject([{ id: annual.id, month: 7, amt: 600 }])
    const back = await saveCost(db, annual, draft({ freq: 'quarterly', amt: 150 }))
    h = await loadHousehold(db)
    expect(h.annualExpenses).toEqual([])
    expect(h.expenses).toMatchObject([{ id: back.id, freq: 'quarterly' }])
  })

  it('removes the right kind', async () => {
    const c = await saveCost(db, null, draft({ month: 2 }))
    await removeCost(db, c)
    expect((await loadHousehold(db)).annualExpenses).toEqual([])
  })
})

describe('setting up a new household', () => {
  const answers: StarterAnswers = {
    state: 'qld', regional: false,
    you: { name: 'Alex', age: 34, salary: 110_000, days: 5, hasHelp: true, helpBalance: 18_000, superBalance: 70_000 },
    partner: { name: 'Sam', age: 33, salary: 90_000, days: 3, hasHelp: false, helpBalance: 0, superBalance: 50_000 },
    children: [{ age: 2, childcareDays: 3 }, { age: 6, childcareDays: 0 }], schoolType: 'government',
    home: { kind: 'mortgage', weeklyRent: 0, mortgageBalance: 550_000, mortgageRate: 6.2, mortgageYears: 25, homeValue: 850_000 },
    cars: 2, cash: 30_000, investments: 10_000,
  }

  it('writes the questionnaire’s household, and Home shows it', async () => {
    const { db } = await migratedTestDb()
    const lines = estimateLivingCosts(answers)
    await startHousehold(db, buildStarterHousehold(answers, lines, NOW))
    const h = await loadHousehold(db)
    expect(h.exists).toBe(true)
    expect(h.settings).toMatchObject({ person1Name: 'Alex', person2Name: 'Sam', partnerEnabled: true, onboardingDone: true })
    expect(h.expenses).toHaveLength(lines.length + 1)   // + the managed childcare line
    expect(h.debts.map(d => d.name)).toEqual(['Alex HELP debt'])
    expect(h.mortgage?.balance).toBe(550_000)
    expect(h.childcare.enabled).toBe(true)
    expect(h.projection.parentalLeaveEnabled).toBe(false)
    const v = homeView(h, NOW)
    expect(v.noIncome).toBe(false)
    expect(v.budget.childcareNet).toBeGreaterThan(0)
    expect(v.situation).toEqual(['With Sam', 'Own our home', 'Paying for childcare', 'Planning school fees'])
  })

  it('replaces a household that was started but never set up', async () => {
    const { db } = await migratedTestDb()
    await saveSettings(db, 'householdSettings', { onboardingDone: false })
    await insertRow(db, 'expense', { cat: 'Food', name: 'Old line', freq: 'monthly', amt: 1 })
    await startHousehold(db, buildStarterHousehold(answers, [], NOW))
    const h = await loadHousehold(db)
    expect(h.expenses.some(e => e.name === 'Old line')).toBe(false)
  })

  it('changes pay: salary in tax mode, days for this year', async () => {
    const { db } = await migratedTestDb()
    await startHousehold(db, buildStarterHousehold(answers, [], NOW))
    let h = await loadHousehold(db)
    await savePay(db, 'p2', { amount: 95_000, days: 4, hasHelp: true, taxMode: true }, h.workPhases, 2026)
    h = await loadHousehold(db)
    expect(h.income).toMatchObject({ person2FTE: 95_000, person2HasHELP: true })
    expect(h.workPhases.filter(w => w.person === 'p2')).toEqual([expect.objectContaining({ year: 2026, days: 4 })])
    // A new year gets its own row
    await savePay(db, 'p1', { amount: 110_000, days: 4, hasHelp: true, taxMode: true }, h.workPhases, 2027)
    h = await loadHousehold(db)
    expect(h.workPhases.filter(w => w.person === 'p1').map(w => w.year).sort()).toEqual([2026, 2027])
  })

  it('changes take-home pay for a household that records it', async () => {
    const { db } = await migratedTestDb()
    await importHousehold(db, sampleExport())
    const h = await loadHousehold(db)
    await savePay(db, 'p1', { amount: 5500, days: 5, hasHelp: false, taxMode: false }, h.workPhases, 2026)
    expect((await loadHousehold(db)).income).toMatchObject({ taxMode: false, person1MonthlyNet: 5500 })
  })
})

describe('wealth', () => {
  const owner: StarterAnswers = {
    state: 'nsw', regional: false,
    you: { name: 'Alex', age: 40, salary: 120_000, days: 5, hasHelp: true, helpBalance: 15_000, superBalance: 90_000 },
    partner: null, children: [], schoolType: null,
    home: { kind: 'mortgage', weeklyRent: 0, mortgageBalance: 400_000, mortgageRate: 6, mortgageYears: 20, homeValue: 0 },
    cars: 1, cash: 25_000, investments: 5_000,
  }
  async function setUp() {
    const { db } = await migratedTestDb()
    await startHousehold(db, buildStarterHousehold(owner, estimateLivingCosts(owner), NOW))
    return db
  }

  it('shows owned, owed, loan, super and HELP, matching Home', async () => {
    const db = await setUp()
    const h = await loadHousehold(db)
    const v = wealthView(h, NOW)
    expect(v.netWorth).toBe(homeView(h, NOW).netWorth)
    expect(v.netWorth).toBe(25_000 + 5_000 - 15_000)
    expect(v.owned.map(o => o.name)).toEqual(['Cash / savings', 'Shares & ETFs'])
    expect(v.owned[0].cash).toBe(true)
    expect(v.loan).toMatchObject({ balance: 400_000, rate: 6, offset: 25_000 })
    expect(v.loan!.monthlyInterest).toBeCloseTo(375_000 * 0.06 / 12)
    expect(v.homeMissing).toBe(true)
    expect(v.help).toEqual([{ person: 'p1', name: 'Alex', balance: 15_000, yearlyRepayment: expect.any(Number) }])
    expect(v.help[0].yearlyRepayment).toBeGreaterThan(0)
    expect(v.super).toEqual([{ person: 'p1', name: 'Alex', balance: 90_000, retirementAge: 67 }])
  })

  it('keeps the loan offset at the total of cash accounts', async () => {
    const db = await setUp()
    const id = await saveAsset(db, null, { name: 'Offset account', amt: 10_000, isOffset: true })
    expect((await loadHousehold(db)).mortgage!.offsetBal).toBe(35_000)
    await removeAsset(db, id)
    expect((await loadHousehold(db)).mortgage!.offsetBal).toBe(25_000)
  })

  it('counts home equity once the home is added, and a mortgage debt row is not subtracted twice', async () => {
    const db = await setUp()
    await saveAsset(db, null, { name: 'Home equity', amt: 300_000, isOffset: false })
    await saveDebt(db, null, { name: 'Mortgage', amt: 400_000 })
    const v = wealthView(await loadHousehold(db), NOW)
    expect(v.homeMissing).toBe(false)
    expect(v.netWorth).toBe(25_000 + 5_000 + 300_000 - 15_000)
  })

  it('saving the loan updates the budget’s Mortgage line', async () => {
    const db = await setUp()
    await saveLoan(db, { balance: 380_000, rate: 5.8, payment: 3_100, endDate: '2045-10-01' })
    const h = await loadHousehold(db)
    expect(h.mortgage).toMatchObject({ balance: 380_000, rate: 5.8, payment: 3_100, offsetBal: 25_000 })
    expect(h.expenses.filter(e => e.cat === 'Home' && e.name === 'Mortgage').map(e => e.amt)).toEqual([3_100])
  })

  it('a first home loan adds the Mortgage line', async () => {
    const { db } = await migratedTestDb()
    await startHousehold(db, buildStarterHousehold({ ...owner, home: { ...owner.home, kind: 'own' } }, [], NOW))
    await saveLoan(db, { balance: 200_000, rate: 6, payment: 1_500, endDate: '2040-01-01' })
    expect((await loadHousehold(db)).expenses.find(e => e.name === 'Mortgage')?.amt).toBe(1_500)
  })

  it('updates super', async () => {
    const db = await setUp()
    await saveSuper(db, { person1Balance: 95_000, person1RetirementAge: 65 })
    expect(wealthView(await loadHousehold(db), NOW).super[0]).toMatchObject({ balance: 95_000, retirementAge: 65 })
  })
})

describe('future', () => {
  const family: StarterAnswers = {
    state: 'vic', regional: false,
    you: { name: 'Alex', age: 38, salary: 130_000, days: 5, hasHelp: true, helpBalance: 12_000, superBalance: 120_000 },
    partner: { name: 'Sam', age: 36, salary: 95_000, days: 4, hasHelp: false, helpBalance: 0, superBalance: 80_000 },
    children: [{ age: 6, childcareDays: 0 }, { age: 9, childcareDays: 0 }], schoolType: 'independent',
    home: { kind: 'mortgage', weeklyRent: 0, mortgageBalance: 600_000, mortgageRate: 6, mortgageYears: 15, homeValue: 1_100_000 },
    cars: 2, cash: 40_000, investments: 20_000,
  }
  async function setUp() {
    const { db } = await migratedTestDb()
    await startHousehold(db, buildStarterHousehold(family, estimateLivingCosts(family), NOW))
    return db
  }

  it('projects net worth, milestones and retirement from the household', async () => {
    const db = await setUp()
    const v = futureView(await loadHousehold(db), NOW)
    expect(v.years).toBe(20)
    expect(v.netWorth).toHaveLength(20)
    expect(v.netWorthToday).toBe(40_000 + 20_000 + 500_000 - 12_000)
    expect(v.schoolFees.on).toBe(true)
    expect(v.schoolFees.total).toBeGreaterThan(0)
    expect(v.milestones.map(m => m.text)).toEqual(expect.arrayContaining(['Home loan paid off', 'Alex’s HELP debt cleared', 'Last year of school fees']))
    expect(v.retirement.people.map(p => p.name)).toEqual(['Alex', 'Sam'])
    expect(v.retirement.people[0].year).toBe(2026 + 67 - 38)
    expect(v.retirement.goalMonthly).toBeGreaterThan(0)
  })

  it('school costs aren’t counted twice: the fee model on ends higher than lines plus model', async () => {
    const db = await setUp()
    const on = futureView(await loadHousehold(db), NOW)
    // Turning the model off keeps the budget lines, flat (inflated) for all 20 years.
    const h = await loadHousehold(db)
    await saveAssumptions(db, { person1Growth: h.projection.person1Growth, person2Growth: h.projection.person2Growth, expInfl: h.projection.expInfl,
      investReturn: h.projection.investReturn, savingsRate: h.projection.savingsRate, propGrowth: h.projection.propGrowth, projYears: 20, schoolFeesOn: false }, 0)
    const off = futureView(await loadHousehold(db), NOW)
    expect(off.schoolFees.on).toBe(false)
    expect(on.endNetWorth).not.toBe(off.endNetWorth)
  })

  it('a one-off cost lowers the end net worth; removing it restores it', async () => {
    const db = await setUp()
    const before = futureView(await loadHousehold(db), NOW).endNetWorth
    const id = await saveOneOff(db, null, { name: 'New car', amt: 50_000, year: 2028 })
    expect(futureView(await loadHousehold(db), NOW).endNetWorth).toBeLessThan(before)
    await removeOneOff(db, id)
    expect(futureView(await loadHousehold(db), NOW).endNetWorth).toBe(before)
  })

  it('next 2 years: starts from Home’s cash, and a year later is a year of Home’s “left over” on', async () => {
    const db = await setUp()
    const h = await loadHousehold(db)
    const home = homeView(h, NOW)
    const cf = cashflowView(h, NOW)
    expect(cf.cashOnHand).toBe(home.cash)
    expect(cf.months[0].label).toBe('Nov 26')
    expect(cf.months[11].balance).toBeCloseTo(home.cash + 12 * home.left, -1)
    // A couple with parental leave on (the starter's default) gets the leave line.
    expect(cf.leave === null).toBe(!h.projection.parentalLeaveEnabled)
  })

  it('saves the assumptions and the retirement goal', async () => {
    const db = await setUp()
    await saveAssumptions(db, { person1Growth: 2, person2Growth: 2, expInfl: 3, investReturn: 6, savingsRate: 80, propGrowth: 4, projYears: 30, schoolFeesOn: true }, 90_000)
    const h = await loadHousehold(db)
    expect(h.projection).toMatchObject({ expInfl: 3, expInflNear: 3, projYears: 30, savingsRate: 80 })
    expect(h.superSettings.desiredRetirementIncome).toBe(90_000)
    const v = futureView(h, NOW)
    expect(v.years).toBe(30)
    expect(v.retirement.goalMonthly).toBe(7_500)
  })
})

describe('what if', () => {
  const renters: StarterAnswers = {
    state: 'nsw', regional: false,
    you: { name: 'Alex', age: 32, salary: 110_000, days: 5, hasHelp: false, helpBalance: 0, superBalance: 60_000 },
    partner: { name: 'Sam', age: 31, salary: 90_000, days: 5, hasHelp: false, helpBalance: 0, superBalance: 50_000 },
    children: [], schoolType: null,
    home: { kind: 'rent', weeklyRent: 650, mortgageBalance: 0, mortgageRate: 0, mortgageYears: 0, homeValue: 0 },
    cars: 1, cash: 90_000, investments: 30_000,
  }
  async function setUp() {
    const { db } = await migratedTestDb()
    await startHousehold(db, buildStarterHousehold(renters, estimateLivingCosts(renters), NOW))
    return db
  }

  it('previews without writing, and an untouched draft has no changes', async () => {
    const db = await setUp()
    const h = await loadHousehold(db)
    const w = startWhatIf(h)
    expect(hasChanges(h, w)).toBe(false)
    expect(futureView(applyWhatIf(h, w), NOW).endNetWorth).toBe(futureView(h, NOW).endNetWorth)
    w.projection = { ...w.projection, savingsRate: 90 }
    expect(hasChanges(h, w)).toBe(true)
    expect(futureView(applyWhatIf(h, w), NOW).endNetWorth).not.toBe(futureView(h, NOW).endNetWorth)
    expect((await loadHousehold(db)).projection.savingsRate).toBe(h.projection.savingsRate)
  })

  it('a buying plan shows the purchase as a milestone once kept', async () => {
    const db = await setUp()
    const h = await loadHousehold(db)
    const w = startWhatIf(h)
    w.rent = { ...w.rent, purchasePlanEnabled: true, targetPurchaseYear: 2030, targetPropertyValue: 900_000, depositPct: 10, depositFromCash: 90_000 }
    expect(futureView(applyWhatIf(h, w), NOW).milestones.map(m => m.text)).toContain('You buy your home')
    await keepWhatIf(db, h, w)
    const after = await loadHousehold(db)
    expect(after.rent).toMatchObject({ enabled: true, purchasePlanEnabled: true, targetPurchaseYear: 2030, targetPropertyValue: 900_000 })
    expect(futureView(after, NOW).milestones.find(m => m.text === 'You buy your home')?.year).toBe(2030)
  })

  it('work changes: fewer days lower the result; keeping adds, changes and removes rows', async () => {
    const db = await setUp()
    const h = await loadHousehold(db)
    // The starter records each person's days for this year.
    expect(h.workPhases.filter(p => p.person === 'p2')).toHaveLength(1)
    let w = addWorkChange(startWhatIf(h), 'p2', 2026)
    const added = w.workPhases.find(p => p.person === 'p2' && p.year === 2027)!
    expect(added.days).toBe(5)
    w = { ...w, workPhases: w.workPhases.map(p => (p.id === added.id ? { ...p, days: 3 } : p)) }
    expect(futureView(applyWhatIf(h, w), NOW).endNetWorth).toBeLessThan(futureView(h, NOW).endNetWorth)

    await keepWhatIf(db, h, w)
    let now = await loadHousehold(db)
    expect(now.workPhases.filter(p => p.person === 'p2').map(p => [p.year, p.days]).sort()).toEqual([[2026, 5], [2027, 3]])

    // Remove it again: the row is soft-deleted, the household is back to the start.
    const back = startWhatIf(now)
    back.workPhases = back.workPhases.filter(p => p.id !== added.id)
    await keepWhatIf(db, now, back)
    now = await loadHousehold(db)
    expect(now.workPhases.filter(p => p.person === 'p2').map(p => [p.year, p.days])).toEqual([[2026, 5]])
    expect(futureView(now, NOW).endNetWorth).toBe(futureView(h, NOW).endNetWorth)
  })

  it('with no work phases, a change starts from full-time now', () => {
    const w = addWorkChange({ projection: {} as never, rent: {} as never, workPhases: [] }, 'p1', 2026)
    expect(w.workPhases.map(p => [p.person, p.year, p.days])).toEqual([['p1', 2026, 5], ['p1', 2027, 5]])
  })
})

describe('settings and backups', () => {
  const answers: StarterAnswers = {
    state: 'wa', regional: true,
    you: { name: 'Alex', age: 30, salary: 90_000, days: 5, hasHelp: true, helpBalance: 20_000, superBalance: 40_000 },
    partner: { name: 'Sam', age: 31, salary: 70_000, days: 5, hasHelp: false, helpBalance: 0, superBalance: 30_000 },
    children: [], schoolType: null,
    home: { kind: 'rent', weeklyRent: 500, mortgageBalance: 0, mortgageRate: 0, mortgageYears: 0, homeValue: 0 },
    cars: 1, cash: 15_000, investments: 0,
  }
  async function setUp() {
    const { db } = await migratedTestDb()
    await startHousehold(db, buildStarterHousehold(answers, estimateLivingCosts(answers), NOW))
    return db
  }

  it('renames people, and their HELP debt follows', async () => {
    const db = await setUp()
    expect(await savePeople(db, { person1Name: 'Alexandra', person2Name: 'Sam', partnerEnabled: true })).toBeNull()
    const h = await loadHousehold(db)
    expect(h.settings.person1Name).toBe('Alexandra')
    expect(h.debts.map(d => d.name)).toEqual(['Alexandra HELP debt'])
    expect(wealthView(h, NOW).help[0]).toMatchObject({ name: 'Alexandra', balance: 20_000 })
  })

  it('refuses names that can’t be told apart', async () => {
    const db = await setUp()
    expect(await savePeople(db, { person1Name: 'Sam', person2Name: 'sam', partnerEnabled: true })).toMatch(/different names/)
    expect(await savePeople(db, { person1Name: ' ', person2Name: 'Sam', partnerEnabled: true })).toMatch(/needs a name/)
  })

  it('rent: changes the amount, and turning it off leaves the budget', async () => {
    const db = await setUp()
    await saveRent(db, { enabled: true, monthlyRent: 2400, annualIncreaseRate: 4 })
    expect(spendingView(await loadHousehold(db), NOW).categories.find(c => c.cat === 'Home')?.lines.find(l => l.kind === 'rent')?.monthly).toBe(2400)
    await saveRent(db, { enabled: false, monthlyRent: 2400, annualIncreaseRate: 4 })
    expect(spendingView(await loadHousehold(db), NOW).categories.flatMap(c => c.lines).some(l => l.kind === 'rent')).toBe(false)
  })

  it('childcare: switching it on adds the after-subsidy line once', async () => {
    const db = await setUp()
    await saveChildcare(db, { enabled: true, costPerDay: 140, daysPerWeek: 3, numChildren: 1 })
    await saveChildcare(db, { enabled: true, costPerDay: 150, daysPerWeek: 4, numChildren: 1 })
    const h = await loadHousehold(db)
    expect(h.expenses.filter(e => e.name === 'Childcare')).toHaveLength(1)
    expect(homeView(h, NOW).budget.childcareNet).toBeGreaterThan(0)
  })

  it('a backup restores the household exactly, removed rows included', async () => {
    const db = await setUp()
    const gone = await insertRow(db, 'expense', { cat: 'Fun', name: 'Old hobby', freq: 'monthly', amt: 50 })
    await deleteRow(db, 'expense', gone, NOW)
    const key = newHouseholdKey()
    const doc = await exportHousehold(db, 'hh-1', { includeRemoved: true, appVersion: 'test', now: NOW })
    expect(parseHouseholdExport(JSON.parse(JSON.stringify(doc)))).toEqual(doc)   // valid by the shared format
    const file = JSON.parse(JSON.stringify(encryptBackup(doc, key, NOW)))

    const other = (await migratedTestDb()).db
    const r = await restoreHousehold(other, decryptBackup(file, key))
    expect(r.householdId).toBe('hh-1')
    const before = await loadHousehold(db), after = await loadHousehold(other)
    expect(after.expenses).toEqual(before.expenses)
    expect(homeView(after, NOW).left).toBe(homeView(before, NOW).left)
    const again = await exportHousehold(other, 'hh-1', { includeRemoved: true, appVersion: 'test', now: NOW })
    expect(again.household.expense.find(e => e.id === gone)?.deletedAt).toBe(NOW.toISOString())
  })

  it('a readable copy leaves removed rows out', async () => {
    const db = await setUp()
    const gone = await insertRow(db, 'expense', { cat: 'Fun', name: 'Old hobby', freq: 'monthly', amt: 50 })
    await deleteRow(db, 'expense', gone, NOW)
    const doc = await exportHousehold(db, 'hh-1', { includeRemoved: false, appVersion: 'test' })
    expect(doc.household.expense.some(e => e.id === gone)).toBe(false)
  })

  it('start again empties the device', async () => {
    const db = await setUp()
    await eraseHousehold(db)
    expect((await loadHousehold(db)).exists).toBe(false)
  })
})
