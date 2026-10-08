// Opens this device's household database and brings its schema up to date.
// The only file in src/data that touches expo-sqlite; everything else takes a
// Db (src/data/db.ts) so it runs the same in tests.
//
// Async all the way: Drizzle's proxy driver over expo-sqlite's async API, on
// every platform. Synchronous SQLite blocks the UI thread on phones, and on
// the web it can't work at all — each sync call busy-waits on SQLite's worker
// for a few milliseconds and fails while the worker is still loading.

import { openDatabaseAsync, type SQLiteBindValue } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { getRandomValues } from 'expo-crypto'
import { applyMigrations } from '@proviso/core/migrate'
import type { Db } from './db'
import { ensureSyncTables } from './sync'

// Record ids need a secure random source (@proviso/core/ids). Browsers and
// Node have crypto.getRandomValues; React Native's Hermes doesn't, so give it
// expo-crypto's.
const g = globalThis as { crypto?: { getRandomValues?: unknown } }
if (typeof g.crypto?.getRandomValues !== 'function') {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues }
}

const FILE = 'proviso.db'

export async function openHouseholdDb(): Promise<Db> {
  const sqlite = await openDatabaseAsync(FILE)
  await sqlite.execAsync('PRAGMA foreign_keys = ON;')
  await applyMigrations({
    exec: sql => sqlite.execAsync(sql),
    all:  sql => sqlite.getAllAsync<Record<string, unknown>>(sql),
  })

  const db = drizzle(async (query, params, method) => {
    const args = params as SQLiteBindValue[]
    if (method === 'run') { await sqlite.runAsync(query, args); return { rows: [] } }
    // Drizzle's proxy driver wants rows as arrays of values, in column order.
    const stmt = await sqlite.prepareAsync(query)
    try {
      const result = await stmt.executeForRawResultAsync(args)
      const rows = await result.getAllAsync()
      return { rows: method === 'get' ? (rows[0] ?? undefined) as unknown as unknown[] : rows }
    } finally {
      await stmt.finalizeAsync()
    }
  })
  await ensureSyncTables(db as unknown as Db)
  return db as unknown as Db
}
