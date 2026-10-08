import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { applyMigrations } from '@proviso/core/migrate'
import type { Db } from '@/data/db'
import { ensureSyncTables } from '@/data/sync'

// The app's data layer against a real SQLite (node:sqlite), migrated with the
// same bundled migrations the phone runs.
// failOn: queries matching it throw (a simulated storage failure); set or clear it any time.
export function testDb(): { db: Db; raw: DatabaseSync; failOn: { re: RegExp | null } } {
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
export async function migratedTestDb() {
  const t = testDb()
  await applyMigrations({
    exec: async sql => { t.raw.exec(sql) },
    all:  async sql => t.raw.prepare(sql).all() as Record<string, unknown>[],
  })
  await ensureSyncTables(t.db)
  return t
}

