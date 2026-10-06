// Applies the schema migrations (migrations.ts, generated from ./drizzle) to
// a SQLite database on any platform. The caller supplies two async functions
// for its own SQLite (expo-sqlite on devices and the web, node:sqlite in
// tests, the relay's driver), so this stays free of platform code.
//
// Applied migrations are recorded in __proviso_migrations; each one runs in a
// transaction, so a failure leaves the database as it was.

import { MIGRATIONS } from './migrations'

export interface SqlExecutor {
  /** Runs one or more statements, no results. */
  exec(sql: string): Promise<void>
  /** Runs a query, returning rows as objects. */
  all(sql: string): Promise<Record<string, unknown>[]>
}

export interface MigrationSet {
  journal:    { entries: { idx: number; tag: string }[] }
  migrations: Record<string, string>
}

/** Returns how many migrations were applied (0 when already up to date). */
export async function applyMigrations(db: SqlExecutor, set: MigrationSet = MIGRATIONS): Promise<number> {
  await db.exec('CREATE TABLE IF NOT EXISTS __proviso_migrations (idx INTEGER PRIMARY KEY, tag TEXT NOT NULL, appliedAt TEXT NOT NULL)')
  const done = new Set((await db.all('SELECT idx FROM __proviso_migrations')).map(r => Number(r.idx)))
  let applied = 0
  for (const { idx, tag } of [...set.journal.entries].sort((a, b) => a.idx - b.idx)) {
    if (done.has(idx)) continue
    const sql = set.migrations[`m${String(idx).padStart(4, '0')}`]
    if (sql === undefined) throw new Error(`Migration ${tag} is missing from the bundle`)
    await db.exec('BEGIN')
    try {
      for (const stmt of sql.split('--> statement-breakpoint')) if (stmt.trim()) await db.exec(stmt)
      await db.exec(`INSERT INTO __proviso_migrations (idx, tag, appliedAt) VALUES (${idx}, '${tag.replace(/'/g, "''")}', '${new Date().toISOString()}')`)
      await db.exec('COMMIT')
    } catch (e) {
      await db.exec('ROLLBACK')
      throw e
    }
    applied++
  }
  return applied
}
