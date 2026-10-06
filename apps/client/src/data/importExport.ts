// Bringing a household onto this device from an export file (Settings →
// Download all your data on the NAS, or a backup).
//
// Before sync exists (Phase 4) an import *replaces* this device's household:
// it's how a household gets onto the phone in the first place. The old rows
// are removed outright — this is local set-up, not a change to sync.

import { sql } from 'drizzle-orm'
import { HOUSEHOLD_TABLES, POCKET_MONEY_TABLES, SCHEMA_VERSION } from '@proviso/core/schema'
import {
  parseHouseholdExport, emptyPocketMoneyTables, EXPORT_FORMAT, EXPORT_VERSION,
  type HouseholdExport, type HouseholdTables, type PocketMoneyTables,
} from '@proviso/core/householdExport'
import type { Db } from './db'

const CHUNK = 100

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (db: Db) => db as any

export interface ImportResult { rows: number; notes: string[]; householdId: string }

/** Validates `input` (parsed JSON) and replaces this device's household with it. */
export async function importHousehold(db: Db, input: unknown): Promise<ImportResult> {
  return restoreHousehold(db, parseHouseholdExport(input))  // throws ExportFormatError with a readable message
}

/** Replaces this device's household with an already-validated export (e.g. from an opened backup). */
export async function restoreHousehold(db: Db, doc: HouseholdExport): Promise<ImportResult> {
  let rows = 0
  await db.run(sql`BEGIN`)
  try {
    for (const t of [...Object.values(HOUSEHOLD_TABLES), ...Object.values(POCKET_MONEY_TABLES)]) {
      await anyDb(db).delete(t)
    }
    const groups: [Record<string, object>, Record<string, unknown[]>][] = [
      [HOUSEHOLD_TABLES, doc.household as unknown as Record<string, unknown[]>],
      ...doc.pocketMoney.map(sp => [POCKET_MONEY_TABLES, sp.tables as unknown as Record<string, unknown[]>] as [Record<string, object>, Record<string, unknown[]>]),
    ]
    for (const [registry, tables] of groups) {
      for (const [name, list] of Object.entries(tables)) {
        for (let i = 0; i < list.length; i += CHUNK) {
          await anyDb(db).insert(registry[name]).values(list.slice(i, i + CHUNK))
        }
        rows += list.length
      }
    }
    await db.run(sql`COMMIT`)
  } catch (err) {
    await db.run(sql`ROLLBACK`)
    throw err
  }
  return { rows, notes: doc.notes, householdId: doc.householdId }
}

/**
 * This device's household as an export document. A backup keeps everything,
 * including removed rows (so it restores exactly, and later merges cleanly);
 * a readable copy leaves removed rows out.
 */
export async function exportHousehold(db: Db, householdId: string, opts: { includeRemoved: boolean; appVersion: string; now?: Date }): Promise<HouseholdExport> {
  const keep = <R extends { deletedAt: string | null }>(rows: R[]) => (opts.includeRemoved ? rows : rows.filter(r => r.deletedAt === null))
  const household = {} as Record<string, unknown[]>
  for (const [name, t] of Object.entries(HOUSEHOLD_TABLES)) household[name] = keep(await anyDb(db).select().from(t))
  // Pocket money: one space per child.
  const spaces = new Map<string, Record<string, unknown[]>>()
  for (const [name, t] of Object.entries(POCKET_MONEY_TABLES)) {
    for (const row of keep(await anyDb(db).select().from(t) as { memberId: string; deletedAt: string | null }[])) {
      const space = spaces.get(row.memberId) ?? (emptyPocketMoneyTables() as unknown as Record<string, unknown[]>)
      space[name].push(row)
      spaces.set(row.memberId, space)
    }
  }
  return {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, schemaVersion: SCHEMA_VERSION,
    exportedAt: (opts.now ?? new Date()).toISOString(), householdId,
    source: { app: 'proviso-app', version: opts.appVersion },
    household: household as unknown as HouseholdTables,
    pocketMoney: [...spaces.entries()].map(([memberId, tables]) => ({ memberId, tables: tables as unknown as PocketMoneyTables })),
    notes: [],
  }
}

/** Removes this device's household entirely (Settings → Start again). */
export async function eraseHousehold(db: Db): Promise<void> {
  await db.run(sql`BEGIN`)
  try {
    for (const t of [...Object.values(HOUSEHOLD_TABLES), ...Object.values(POCKET_MONEY_TABLES)]) await anyDb(db).delete(t)
    await db.run(sql`COMMIT`)
  } catch (err) {
    await db.run(sql`ROLLBACK`)
    throw err
  }
}
