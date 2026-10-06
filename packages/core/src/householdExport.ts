// The household export file: every row of a household, in the local-first
// schema (schema.ts), as one JSON document. It's the one format used for:
//   - moving a NAS household into the app (apps/web exports, the app imports)
//   - "download all your data" at any time (an ownership guarantee, D5)
//   - backups a user keeps wherever they like
//
// Rows are validated against the Drizzle column definitions directly, so this
// file can't fall out of step with the schema.

import { getTableColumns, type Table } from 'drizzle-orm'
import {
  HOUSEHOLD_TABLES, POCKET_MONEY_TABLES, SCHEMA_VERSION, SETTINGS_ID,
  type HouseholdRow, type HouseholdTableName, type PocketMoneyRow, type PocketMoneyTableName,
} from './schema'
import { isRowId } from './ids'

export const EXPORT_FORMAT  = 'proviso-household'
export const EXPORT_VERSION = 1

export type HouseholdTables   = { [T in HouseholdTableName]: HouseholdRow<T>[] }
export type PocketMoneyTables = { [T in PocketMoneyTableName]: PocketMoneyRow<T>[] }

export interface HouseholdExport {
  format:        typeof EXPORT_FORMAT
  version:       typeof EXPORT_VERSION
  schemaVersion: number
  exportedAt:    string      // ISO timestamp
  householdId:   string
  source:        { app: string; version: string }
  household:     HouseholdTables
  /** One pocket-money space per child (decision D6). */
  pocketMoney:   { memberId: string; tables: PocketMoneyTables }[]
  /** Anything the exporter couldn't carry across exactly, in plain words. */
  notes:         string[]
}

export class ExportFormatError extends Error {
  constructor(message: string) { super(message); this.name = 'ExportFormatError' }
}

const SETTINGS_TABLE_IDS: Partial<Record<HouseholdTableName, string>> = {
  householdSettings:  SETTINGS_ID.household,
  incomeSettings:     SETTINGS_ID.income,
  mortgageSettings:   SETTINGS_ID.mortgage,
  childcareSettings:  SETTINGS_ID.childcare,
  projectionSettings: SETTINGS_ID.projections,
  superSettings:      SETTINGS_ID.super,
  rentSettings:       SETTINGS_ID.rent,
  actualsSettings:    SETTINGS_ID.actuals,
}

/** Empty table set — every household table present, no rows. */
export function emptyHouseholdTables(): HouseholdTables {
  return Object.fromEntries(Object.keys(HOUSEHOLD_TABLES).map(k => [k, []])) as unknown as HouseholdTables
}

export function emptyPocketMoneyTables(): PocketMoneyTables {
  return Object.fromEntries(Object.keys(POCKET_MONEY_TABLES).map(k => [k, []])) as unknown as PocketMoneyTables
}

/**
 * Checks an export file and returns it typed. Throws ExportFormatError with a
 * message fit to show a user (it names the table, row and field at fault).
 */
export function parseHouseholdExport(input: unknown): HouseholdExport {
  const doc = obj(input, 'The file')
  if (doc.format !== EXPORT_FORMAT) throw new ExportFormatError('This isn’t a Proviso household export.')
  if (doc.version !== EXPORT_VERSION) throw new ExportFormatError(`This export uses format version ${String(doc.version)}; this app reads version ${EXPORT_VERSION}. Update the app.`)
  if (typeof doc.schemaVersion !== 'number' || !Number.isInteger(doc.schemaVersion) || doc.schemaVersion < 1) {
    throw new ExportFormatError('The export has no valid schema version.')
  }
  if (doc.schemaVersion > SCHEMA_VERSION) {
    throw new ExportFormatError('This export was made by a newer version of Proviso. Update the app, then try again.')
  }
  for (const k of ['exportedAt', 'householdId'] as const) {
    if (typeof doc[k] !== 'string' || !doc[k]) throw new ExportFormatError(`The export is missing "${k}".`)
  }
  const source = obj(doc.source, 'source')
  if (typeof source.app !== 'string' || typeof source.version !== 'string') throw new ExportFormatError('The export’s "source" is incomplete.')
  if (!Array.isArray(doc.notes) || !doc.notes.every(n => typeof n === 'string')) throw new ExportFormatError('The export’s "notes" must be a list of text.')

  checkTables(obj(doc.household, 'household'), HOUSEHOLD_TABLES, 'household')
  if (!Array.isArray(doc.pocketMoney)) throw new ExportFormatError('The export’s "pocketMoney" must be a list.')
  doc.pocketMoney.forEach((space, i) => {
    const s = obj(space, `pocketMoney[${i}]`)
    if (!isRowId(s.memberId)) throw new ExportFormatError(`pocketMoney[${i}] has no valid memberId.`)
    checkTables(obj(s.tables, `pocketMoney[${i}].tables`), POCKET_MONEY_TABLES, `pocketMoney[${i}]`)
  })
  return doc as unknown as HouseholdExport
}

function checkTables(tables: Record<string, unknown>, registry: Record<string, Table>, where: string): void {
  for (const name of Object.keys(tables)) {
    if (!(name in registry)) throw new ExportFormatError(`${where} has an unknown table "${name}".`)
  }
  for (const [name, table] of Object.entries(registry)) {
    const rows = tables[name]
    if (!Array.isArray(rows)) throw new ExportFormatError(`${where} is missing the "${name}" table.`)
    const settingsId = SETTINGS_TABLE_IDS[name as HouseholdTableName]
    if (settingsId && rows.length > 1) throw new ExportFormatError(`"${name}" can have at most one row.`)
    const seen = new Set<string>()
    rows.forEach((row, i) => {
      checkRow(obj(row, `${name}[${i}]`), table, `${name}[${i}]`, settingsId)
      const id = (row as { id: string }).id
      if (seen.has(id)) throw new ExportFormatError(`"${name}" has two rows with the id ${id}.`)
      seen.add(id)
    })
  }
}

function checkRow(row: Record<string, unknown>, table: Table, at: string, settingsId?: string): void {
  const columns = getTableColumns(table)
  for (const key of Object.keys(row)) {
    if (!(key in columns)) throw new ExportFormatError(`${at} has an unknown field "${key}".`)
  }
  if (settingsId ? row.id !== settingsId : !isRowId(row.id)) {
    throw new ExportFormatError(`${at} has an invalid id.`)
  }
  for (const [key, col] of Object.entries(columns)) {
    const v = row[key]
    if (v === undefined) {
      if (col.notNull && !col.hasDefault) throw new ExportFormatError(`${at} is missing "${key}".`)
      continue
    }
    if (v === null) {
      if (col.notNull) throw new ExportFormatError(`${at} has no value for "${key}".`)
      continue
    }
    const ok =
      col.dataType === 'string'  ? typeof v === 'string' :
      col.dataType === 'number'  ? typeof v === 'number' && Number.isFinite(v) :
      col.dataType === 'boolean' ? typeof v === 'boolean' :
      false
    if (!ok) throw new ExportFormatError(`${at} has the wrong kind of value for "${key}".`)
    const allowed = (col as { enumValues?: readonly string[] }).enumValues
    if (allowed?.length && !allowed.includes(v as string)) {
      throw new ExportFormatError(`${at} has "${String(v)}" for "${key}", which isn’t one of: ${allowed.join(', ')}.`)
    }
  }
}

function obj(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ExportFormatError(`${what} isn’t in the expected shape.`)
  return v as Record<string, unknown>
}
