import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { mapLegacyHousehold, type LegacyHousehold } from '@/lib/householdExport'
import { parseHouseholdExport, type HouseholdExport } from '@proviso/core/householdExport'
import { contentId } from '@proviso/core/ids'
import { SETTINGS_ID } from '@proviso/core/schema'

const D = (s: string) => new Date(s)
const at = D('2026-01-01T00:00:00Z')
const HOUSEHOLD_ID = '01990000-0000-7000-8000-000000000001'

// A small made-up household covering every mapping rule.
function legacy(): LegacyHousehold {
  return {
    householdSettings: { id: 1, person1Name: 'Alex', person2Name: 'Sam', partnerEnabled: true, onboardingDone: true, householdId: HOUSEHOLD_ID },
    users: [{ id: 1, name: 'Alex', role: 'CFO' }, { id: 2, name: 'Sam', role: 'PARTNER' }, { id: 3, name: 'Kid', role: 'CHILD' }],
    expenses: [{ id: 1, cat: 'Groceries', name: 'Weekly shop', freq: 'weekly', amt: 200, createdAt: at, updatedAt: at }],
    annualExpenses: [{ id: 1, name: 'Car rego', cat: 'Transport', amt: 900, month: 3, createdAt: at, updatedAt: at }],
    debts: [{ id: 1, name: 'Alex HELP debt', amt: 18000 }],
    assets: [{ id: 1, name: 'Savings', amt: 25000, isOffset: true }],
    mortgage: { id: 1, balance: 400000, rate: 6, payment: 2800, offsetBal: 0, endDate: '2050-01' },
    childcare: { id: 1, enabled: true, costPerDay: 140, daysPerWeek: 3, numChildren: 1 },
    income: { id: 1, taxMode: true, person1FTE: 100000, person2FTE: 80000, person1HasHELP: true, person2HasHELP: false,
      person1MonthlyNet: 0, person2MonthlyNet: 0, person1Age: 35, person2Age: 34 },
    person1Phases: [{ id: 1, year: 2026, days: 5 }],
    person2Phases: [{ id: 1, year: 2026, days: 3 }],
    projection: null,
    lifePhases: [],
    oneOffs: [{ id: 1, name: 'Holiday', amt: 8000, year: 2027 }],
    transactions: [
      { id: 10, dateStr: '01/09/2026', ym: '2026-09', desc: 'TEST GROCER', amt: -45.2, cat: 'Groceries', originalCat: 'Groceries', catSource: 'system', lumpy: false, importedAt: at },
      { id: 11, dateStr: '02/09/2026', ym: '2026-09', desc: 'TEST CHARITY', amt: -50, cat: 'Gifts', originalCat: 'Other', catSource: 'custom', lumpy: false, importedAt: at },
    ],
    rules: [{ id: 1, pattern: 'GROCER', cat: 'Groceries', source: 'user', hits: 3 }],
    suggestions: [{ id: 1, cat: 'Groceries', status: 'pending' }],
    actuals: { id: 1, useActualsProjections: false },
    schoolFeeLevels: [{ id: 1, level: 'Prep', tuition: 5000, fixed: 500 }],
    helpDetails: [
      { id: 1, member: 'Alex', financialYearEnding: 2026, openingFyBalance: 20000, estimatedWithheld: 2000, voluntaryRepayments: 0, cpiRate: 3.2, createdAt: at, updatedAt: at },
    ],
    superSettings: { id: 1, currentBalance: 90000, retirementAge: 67, additionalContribs: 0, sgRate: 0.12, investmentReturn: 0.06,
      fundFeePercent: 0.005, inflationRate: 0.04, desiredRetirementIncome: 60000, partnerEnabled: true, partnerBalance: 70000,
      partnerRetirementAge: 65, partnerAdditionalContribs: 1000, currentAge: 30, salaryExcSuper: 0, salaryGrowthRate: 0.04,
      drawdownStrategy: 'fourPercent', drawdownPct: 5 },
    superHistory: [
      { id: 1, member: 'sam', financialYearEnding: 2025, concessionalCap: 30000, concessionalUtilised: 12000, totalSuperBalance: 65000, createdAt: at, updatedAt: at },
      // An old name that no longer matches anyone, and collides with Alex's 2025 row once it falls back to p1.
      { id: 2, member: 'Old Name', financialYearEnding: 2025, concessionalCap: 30000, concessionalUtilised: 9000, totalSuperBalance: 80000, createdAt: at, updatedAt: D('2026-02-01T00:00:00Z') },
      { id: 3, member: 'Alex', financialYearEnding: 2025, concessionalCap: 30000, concessionalUtilised: 15000, totalSuperBalance: 85000, createdAt: at, updatedAt: at },
    ],
    parcels: [{ id: 1, member: 'Sam', name: 'ETF', quantity: 10, purchasePrice: 100, purchaseDate: '2024-01-02', currentPrice: 110, sellYear: 2030, createdAt: at, updatedAt: at }],
    netWorthSnapshots: [{ id: 1, takenAt: at, totalAssets: 100, totalDebts: 50, netWorth: 50, source: 'auto', createdAt: at }],
    donations: [{ id: 1, charity: 'Test Charity', abn: '', amount: 50, date: '2026-09-02', financialYr: 2027, source: 'imported', txnId: 11, notes: '', createdAt: at, updatedAt: at }],
    workExpenses: [{ id: 1, description: 'Laptop', amount: 1200, date: '2026-08-01', category: 'Equipment', financialYr: 2027, source: 'manual', txnId: 999, receiptRef: '', notes: '', createdAt: at, updatedAt: at }],
    rent: null,
    allowances: [{ id: 1, userId: 3, amount: 10, dayOfWeek: 5, createdAt: at, updatedAt: at }],
    pocketMoney: [{ id: 1, userId: 3, amount: 10, description: 'Allowance', date: '2026-10-03', category: 'general', createdAt: at }],
  }
}

const opts = { householdId: HOUSEHOLD_ID, exportedAt: D('2026-10-06T00:00:00Z'), appVersion: 'test' }
const exportOf = (L = legacy()): HouseholdExport => parseHouseholdExport(JSON.parse(JSON.stringify(mapLegacyHousehold(L, opts))))

function migratedDb(): DatabaseSync {
  const dir = path.resolve(__dirname, '../../../packages/core/drizzle')
  const db = new DatabaseSync(':memory:')
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(dir, f), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) db.exec(stmt)
  }
  return db
}

function insertAll(db: DatabaseSync, tables: Record<string, Record<string, unknown>[]>): number {
  let n = 0
  for (const [table, rows] of Object.entries(tables)) {
    for (const row of rows) {
      const cols = Object.keys(row)
      const values = cols.map(c => typeof row[c] === 'boolean' ? (row[c] ? 1 : 0) : row[c]) as (string | number | null)[]
      db.prepare(`INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...values)
      n++
    }
  }
  return n
}

describe('mapLegacyHousehold', () => {
  it('produces a file the app accepts, whose rows load into the new schema', () => {
    const exp = exportOf()
    const db = migratedDb()
    const n = insertAll(db, exp.household as unknown as Record<string, Record<string, unknown>[]>)
      + exp.pocketMoney.reduce((s, sp) => s + insertAll(db, sp.tables as unknown as Record<string, Record<string, unknown>[]>), 0)
    expect(n).toBeGreaterThan(20)
    expect((db.prepare('SELECT count(*) c FROM "transaction"').get() as { c: number }).c).toBe(2)
  })

  it('gives the same ids every time it runs', () => {
    expect(JSON.stringify(exportOf())).toBe(JSON.stringify(exportOf()))
  })

  it('derives ids from natural keys, matching what the app will produce', () => {
    const exp = exportOf()
    expect(exp.household.transaction[0].id).toBe(contentId('transaction', '01/09/2026', 'TEST GROCER', -45.2))
    expect(exp.household.categorisationRule[0].id).toBe(contentId('categorisationRule', 'GROCER'))
    expect(exp.household.helpDebtDetail[0].id).toBe(contentId('helpDebtDetail', 'p1', 2026))
  })

  it('uses fixed ids for settings rows and leaves absent settings out', () => {
    const exp = exportOf()
    expect(exp.household.householdSettings[0].id).toBe(SETTINGS_ID.household)
    expect(exp.household.superSettings[0].id).toBe(SETTINGS_ID.super)
    expect(exp.household.projectionSettings).toEqual([])
    expect(exp.household.rentSettings).toEqual([])
  })

  it('turns names into p1 / p2 (ignoring case) and merges the two work-pattern tables', () => {
    const exp = exportOf()
    expect(exp.household.investmentParcel[0].person).toBe('p2')
    expect(exp.household.workPhase.map(w => [w.person, w.days])).toEqual([['p1', 5], ['p2', 3]])
    expect(exp.household.superHistory.find(h => h.person === 'p2')?.concessionalUtilised).toBe(12000)
  })

  it('says so when a name matches nobody, and keeps the newest of colliding records', () => {
    const exp = exportOf()
    const p1_2025 = exp.household.superHistory.filter(h => h.person === 'p1' && h.financialYearEnding === 2025)
    expect(p1_2025).toHaveLength(1)
    expect(p1_2025[0].concessionalUtilised).toBe(9000)  // "Old Name" row, updated most recently
    expect(exp.notes.join(' ')).toMatch(/didn’t match either person’s current name; assigned to Alex/)
    expect(exp.notes.join(' ')).toMatch(/kept the most recently updated/)
  })

  it('renames super fields and drops the unused ones', () => {
    const s = exportOf().household.superSettings[0]
    expect(s).toMatchObject({ person1Balance: 90000, person2Balance: 70000, person2RetirementAge: 65, person2AdditionalContribs: 1000, drawdownStrategy: 'fourPercent', drawdownPct: 5 })
    expect(s).not.toHaveProperty('currentAge')
    expect(s).not.toHaveProperty('partnerEnabled')
  })

  it('links imported donations to their transaction and drops dangling links with a note', () => {
    const exp = exportOf()
    expect(exp.household.donation[0].transactionId).toBe(exp.household.transaction[1].id)
    expect(exp.household.workExpense[0].transactionId).toBeNull()
    expect(exp.notes.join(' ')).toMatch(/work expense was linked to a bank transaction that no longer exists/)
  })

  it('puts pocket money in its own space per child, outside household finances', () => {
    const exp = exportOf()
    const kid = exp.household.member.find(m => m.role === 'CHILD')!
    expect(exp.pocketMoney).toHaveLength(1)
    expect(exp.pocketMoney[0].memberId).toBe(kid.id)
    expect(exp.pocketMoney[0].tables.pocketMoneyTx[0].memberId).toBe(kid.id)
  })

  it('never carries sign-in data', () => {
    const text = JSON.stringify(exportOf())
    for (const k of ['passwordHash', 'totpSecret', 'username', 'email', 'token', 'credentialId']) expect(text).not.toContain(k)
  })
})
