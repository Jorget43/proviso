import { describe, it, expect } from 'vitest'
import {
  parseHouseholdExport, emptyHouseholdTables, emptyPocketMoneyTables, ExportFormatError,
  EXPORT_FORMAT, EXPORT_VERSION, type HouseholdExport,
} from '../src/householdExport'
import { SCHEMA_VERSION, SETTINGS_ID } from '../src/schema'
import { contentId } from '../src/ids'

const ID = (n: number) => contentId('test', n)

function sample(): HouseholdExport {
  const household = emptyHouseholdTables()
  household.householdSettings.push({ id: SETTINGS_ID.household, deletedAt: null, person1Name: 'Alex', person2Name: 'Sam', partnerEnabled: true, onboardingDone: true, state: null, regional: false })
  household.expense.push({ id: ID(1), deletedAt: null, cat: 'Groceries', name: 'Weekly shop', freq: 'weekly', amt: 200 })
  household.investmentParcel.push({ id: ID(2), deletedAt: null, person: 'p2', name: 'ETF', quantity: 10, purchasePrice: 100, purchaseDate: '2024-01-02', currentPrice: 110, sellYear: null })
  const member = ID(3)
  household.member.push({ id: member, deletedAt: null, name: 'Kid', role: 'CHILD' })
  const tables = emptyPocketMoneyTables()
  tables.pocketMoneyTx.push({ id: ID(4), deletedAt: null, memberId: member, amount: 5, description: 'Chores', date: '2026-10-01', category: 'general' })
  return {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, schemaVersion: SCHEMA_VERSION,
    exportedAt: '2026-10-06T00:00:00.000Z', householdId: ID(0),
    source: { app: 'test', version: '0' },
    household, pocketMoney: [{ memberId: member, tables }], notes: [],
  }
}

// Round-trip through JSON, as a real file would be.
const viaJson = (x: unknown) => JSON.parse(JSON.stringify(x))
const bad = (mutate: (d: Record<string, any>) => void) => {  // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = viaJson(sample()); mutate(d)
  return () => parseHouseholdExport(d)
}

describe('parseHouseholdExport', () => {
  it('accepts a valid export', () => {
    const parsed = parseHouseholdExport(viaJson(sample()))
    expect(parsed.household.expense[0].name).toBe('Weekly shop')
    expect(parsed.pocketMoney[0].tables.pocketMoneyTx).toHaveLength(1)
  })

  it('accepts columns left out when they have defaults', () => {
    expect(bad(d => { delete d.household.expense[0].deletedAt; delete d.household.householdSettings[0].onboardingDone })).not.toThrow()
  })

  it('rejects files that aren’t exports, or are from a newer version', () => {
    expect(() => parseHouseholdExport({ hello: 1 })).toThrow(/isn’t a Proviso household export/)
    expect(bad(d => { d.schemaVersion = SCHEMA_VERSION + 1 })).toThrow(/newer version/)
    expect(bad(d => { d.version = 99 })).toThrow(/format version 99/)
  })

  it('names the table, row and field at fault', () => {
    expect(bad(d => { d.household.expense[0].amt = '200' })).toThrow('expense[0] has the wrong kind of value for "amt".')
    expect(bad(d => { d.household.expense[0].freq = 'fortnightly' })).toThrow(/expense\[0\] has "fortnightly" for "freq"/)
    expect(bad(d => { delete d.household.expense[0].name })).toThrow('expense[0] is missing "name".')
    expect(bad(d => { d.household.expense[0].colour = 'red' })).toThrow('expense[0] has an unknown field "colour".')
    expect(bad(d => { d.household.investmentParcel[0].person = 'Sam' })).toThrow(/isn’t one of: p1, p2/)
  })

  it('checks ids: row ids are UUIDs, settings rows use their fixed id, no duplicates', () => {
    expect(bad(d => { d.household.expense[0].id = '7' })).toThrow(/invalid id/)
    expect(bad(d => { d.household.householdSettings[0].id = ID(9) })).toThrow(/invalid id/)
    expect(bad(d => { d.household.expense.push({ ...d.household.expense[0] }) })).toThrow(/two rows with the id/)
    expect(bad(d => { d.household.householdSettings.push({ ...d.household.householdSettings[0] }) })).toThrow(/at most one row/)
  })

  it('requires every table and rejects unknown ones', () => {
    expect(bad(d => { delete d.household.debt })).toThrow(/missing the "debt" table/)
    expect(bad(d => { d.household.session = [] })).toThrow(/unknown table "session"/)
  })

  it('reads a table added after the file was made as empty (v2 files have no children)', () => {
    const v2 = viaJson(sample()); v2.schemaVersion = 2; delete v2.household.child
    expect(parseHouseholdExport(v2).household.child).toEqual([])
    // A v3 file must have it.
    expect(bad(d => { delete d.household.child })).toThrow(/missing the "child" table/)
  })

  it('accepts adults’ birth years and children (v3)', () => {
    const d = viaJson(sample())
    d.household.incomeSettings = [{ id: SETTINGS_ID.income, deletedAt: null, person1Age: 40, person2Age: 38, person1BirthYear: 1986, person2BirthYear: 1988 }]
    d.household.child = [{ id: ID(5), deletedAt: null, name: null, birthYear: 2020, birthMonth: 3 }]
    const parsed = parseHouseholdExport(d)
    expect(parsed.household.child[0].birthYear).toBe(2020)
    expect(bad(x => { x.household.child = [{ id: ID(5), deletedAt: null, name: 'Alex' }] })).toThrow(/birthYear/)
  })

  it('throws ExportFormatError, so callers can show the message', () => {
    expect(bad(d => { d.household = 'x' })).toThrow(ExportFormatError)
  })
})
