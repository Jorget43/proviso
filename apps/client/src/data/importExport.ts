// Bringing a household onto this device from an export file (Settings →
// Download all your data on the NAS, or a backup).
//
// Before sync exists (Phase 4) an import *replaces* this device's household:
// it's how a household gets onto the phone in the first place. The old rows
// are removed outright — this is local set-up, not a change to sync.

import { sql } from 'drizzle-orm'
import { HOUSEHOLD_TABLES, POCKET_MONEY_TABLES } from '@proviso/core/schema'
import { parseHouseholdExport, type HouseholdExport } from '@proviso/core/householdExport'
import type { Db } from './db'

const CHUNK = 100

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (db: Db) => db as any

export interface ImportResult { rows: number; notes: string[] }

/** Validates `input` (parsed JSON) and replaces this device's household with it. */
export async function importHousehold(db: Db, input: unknown): Promise<ImportResult> {
  const doc: HouseholdExport = parseHouseholdExport(input)  // throws ExportFormatError with a readable message
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
  return { rows, notes: doc.notes }
}
