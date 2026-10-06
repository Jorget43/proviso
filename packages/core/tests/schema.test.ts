import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { getTableColumns, getTableName } from 'drizzle-orm'
import { HOUSEHOLD_TABLES, POCKET_MONEY_TABLES } from '../src/schema'

// The generated migrations must build exactly the schema in src/schema.ts.
// (CI also re-runs drizzle-kit and fails if it would generate anything new.)

const DRIZZLE_DIR = path.resolve(__dirname, '../drizzle')

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  for (const f of readdirSync(DRIZZLE_DIR).filter(f => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(DRIZZLE_DIR, f), 'utf8').split('--> statement-breakpoint')) {
      if (stmt.trim()) db.exec(stmt)
    }
  }
  return db
}

describe('migrations', () => {
  const db = migratedDb()
  const all = { ...HOUSEHOLD_TABLES, ...POCKET_MONEY_TABLES }

  it('create every table in the registry, and nothing else', () => {
    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[])
      .map(r => r.name).sort()
    expect(tables).toEqual(Object.values(all).map(t => getTableName(t)).sort())
  })

  it('give each table exactly the schema’s columns', () => {
    for (const t of Object.values(all)) {
      const name = getTableName(t)
      const cols = (db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]).map(c => c.name).sort()
      expect(cols, name).toEqual(Object.values(getTableColumns(t)).map(c => c.name).sort())
    }
  })

  it('follow the sync rules: text id primary key, a deletedAt column, no unique indexes', () => {
    for (const t of Object.values(all)) {
      const name = getTableName(t)
      const info = db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; type: string; pk: number }[]
      const pk = info.filter(c => c.pk)
      expect(pk.map(c => [c.name, c.type.toLowerCase()]), name).toEqual([['id', 'text']])
      expect(info.some(c => c.name === 'deletedAt'), name).toBe(true)
      const unique = (db.prepare(`PRAGMA index_list("${name}")`).all() as { unique: number; origin: string }[])
        .filter(i => i.unique && i.origin !== 'pk')
      expect(unique, `${name} must not have unique constraints`).toEqual([])
    }
  })

  it('keep column names identical to the TypeScript keys', () => {
    for (const t of Object.values(all)) {
      for (const [key, col] of Object.entries(getTableColumns(t))) expect(col.name, getTableName(t)).toBe(key)
    }
  })
})
