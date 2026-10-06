import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { applyMigrations } from '@proviso/core/migrate'
import { emptyHouseholdTables, EXPORT_FORMAT, EXPORT_VERSION, type HouseholdExport } from '@proviso/core/householdExport'
import { SCHEMA_VERSION, SETTINGS_ID } from '@proviso/core/schema'
import { contentId } from '@proviso/core/ids'
import type { Db } from '@/data/db'
import { loadHousehold } from '@/data/household'
import { importHousehold } from '@/data/importExport'
import { insertRow, updateRow, deleteRow, saveSettings } from '@/data/mutate'
import { homeView, spendingView } from '@/data/views'
import { saveCost, removeCost, kindOf, type CostDraft } from '@/data/costs'
import { startHousehold, savePay } from '@/data/setup'
import { estimateLivingCosts, buildStarterHousehold, type StarterAnswers } from '@proviso/core/starter'

// The app's data layer against a real SQLite (node:sqlite), migrated with the
// same bundled migrations the phone runs.
// failOn: queries matching it throw (a simulated storage failure); set or clear it any time.
function testDb(): { db: Db; raw: DatabaseSync; failOn: { re: RegExp | null } } {
  const failOn: { re: RegExp | null } = { re: null }
  const raw = new DatabaseSync(':memory:')
  const db = drizzle(async (query, params, method) => {
    if (failOn.re?.test(query)) throw new Error('disk full (simulated)')
    const stmt = raw.prepare(query)
    const args = params as (string | number | null)[]
    if (method === 'run') { stmt.run(...args); return { rows: [] } }
    stmt.setReturnArrays(true)
    if (method === 'get') return { rows: (stmt.get(...args) ?? undefined) as unknown as unknown[] }
    return { rows: stmt.all(...args) as unknown as unknown[] }
  })
  return { db: db as unknown as Db, raw, failOn }
}

// Migrated with the same migrator and bundle the phone uses.
async function migratedTestDb() {
  const t = testDb()
  await applyMigrations({
    exec: async sql => { t.raw.exec(sql) },
    all:  async sql => t.raw.prepare(sql).all() as Record<string, unknown>[],
  })
  return t
}

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
    expect(r).toEqual({ rows: 8, notes: ['A sample note'] })
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
    home: { kind: 'mortgage', weeklyRent: 0, mortgageBalance: 550_000, mortgageRate: 6.2, mortgageYears: 25 },
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
    expect(v.situation).toEqual(['With Sam', 'Own our home', 'Paying for childcare'])
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
