#!/usr/bin/env node
// One-time upgrade: move a database created by the old 29-step migration
// chain (0001_init … 0029_net_worth_snapshots) onto the squashed
// 0001_baseline migration.
//
// Rather than just rewriting the _prisma_migrations bookkeeping, this rebuilds
// the database: a fresh file is created from the baseline (so table
// definitions, defaults and indexes exactly match prisma/schema.prisma), every
// row is copied across verbatim with INSERT … SELECT, row counts and foreign
// keys are verified, and only then are the files swapped. The original is kept
// as <name>-pre-baseline.bak next to it. On any failure the original database
// is left untouched.
//
// Usage: node prisma/adopt-baseline.cjs [path/to/db]   (defaults to DATABASE_URL)
// Exit codes: 0 = nothing to do / upgraded; 2 = could not upgrade (DB untouched).

/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS, run directly by node in the container (no build step) */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { PrismaClient } = require('@prisma/client')

const BASELINE = '0001_baseline'
// The last migration of the old chain. Only databases fully up to date with
// it can be rebuilt safely — the baseline reproduces exactly that schema.
const LEGACY_HEAD = '0029_net_worth_snapshots'

function dbPathFromArgs() {
  if (process.argv[2]) return path.resolve(process.argv[2])
  const url = process.env.DATABASE_URL ?? ''
  if (!url.startsWith('file:')) throw new Error('DATABASE_URL must be a file: URL (or pass a path)')
  return path.resolve(url.slice('file:'.length).split('?')[0])
}

function client(file) {
  return new PrismaClient({ datasources: { db: { url: `file:${file}?connection_limit=1` } } })
}

function log(msg) {
  console.log(`[adopt-baseline] ${msg}`)
}

async function tableNames(db, schema = 'main') {
  const rows = await db.$queryRawUnsafe(
    `SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'`,
  )
  return rows.map(r => r.name)
}

async function columnNames(db, schema, table) {
  const rows = await db.$queryRawUnsafe(`PRAGMA ${schema}.table_info("${table}")`)
  return rows.map(r => r.name)
}

async function count(db, schema, table) {
  const rows = await db.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM ${schema}."${table}"`)
  return Number(rows[0].n)
}

async function main() {
  const dbPath = dbPathFromArgs()
  if (!fs.existsSync(dbPath)) {
    log(`no database at ${dbPath} — nothing to do`)
    return 0
  }

  // ── 1. Inspect the migration history ──────────────────────────────────────
  const old = client(dbPath)
  let applied
  try {
    const hasTable = await old.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'`,
    )
    if (hasTable.length === 0) {
      log('no migration history — nothing to do')
      return 0
    }
    const rows = await old.$queryRawUnsafe(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    )
    applied = new Set(rows.map(r => r.migration_name))
  } finally {
    await old.$disconnect()
  }

  if (applied.has(BASELINE)) return 0 // already on the baseline
  if (!applied.has(LEGACY_HEAD)) {
    log(`ERROR: this database predates ${LEGACY_HEAD}, the last migration of the old chain.`)
    log('It cannot be upgraded automatically and has been left untouched.')
    log('Restore a backup taken on a newer version, or start fresh with a new database.')
    return 2
  }

  log(`legacy migration history found — rebuilding ${dbPath} on ${BASELINE}`)

  // ── 2. Create a fresh database from the baseline ──────────────────────────
  const tmpPath = `${dbPath}.rebuild.tmp`
  for (const f of [tmpPath, `${tmpPath}-journal`]) fs.rmSync(f, { force: true })
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: `file:${tmpPath}` },
    stdio: 'inherit',
  })

  // ── 3. Copy every row across, verbatim ────────────────────────────────────
  const fresh = client(tmpPath)
  let ok = false
  try {
    await fresh.$executeRawUnsafe(`ATTACH DATABASE '${dbPath.replace(/'/g, "''")}' AS old`)
    await fresh.$queryRawUnsafe('PRAGMA foreign_keys = OFF')

    const newTables = await tableNames(fresh, 'main')
    const oldTables = await tableNames(fresh, 'old')

    // Refuse to drop data: every old table and column must have a home.
    for (const t of oldTables) {
      if (!newTables.includes(t)) throw new Error(`table "${t}" has no equivalent in the baseline`)
      const newCols = await columnNames(fresh, 'main', t)
      for (const c of await columnNames(fresh, 'old', t)) {
        if (!newCols.includes(c)) throw new Error(`column "${t}"."${c}" has no equivalent in the baseline`)
      }
    }

    for (const t of oldTables) {
      const cols = (await columnNames(fresh, 'old', t)).map(c => `"${c}"`).join(', ')
      await fresh.$executeRawUnsafe(`INSERT INTO main."${t}" (${cols}) SELECT ${cols} FROM old."${t}"`)
      const [before, after] = [await count(fresh, 'old', t), await count(fresh, 'main', t)]
      if (before !== after) throw new Error(`row count mismatch in "${t}": ${before} → ${after}`)
    }

    // Keep AUTOINCREMENT counters, so ids of deleted rows are never reused.
    await fresh.$executeRawUnsafe(`
      UPDATE main.sqlite_sequence
      SET seq = (SELECT o.seq FROM old.sqlite_sequence o WHERE o.name = main.sqlite_sequence.name)
      WHERE name IN (SELECT name FROM old.sqlite_sequence)
        AND seq < (SELECT o.seq FROM old.sqlite_sequence o WHERE o.name = main.sqlite_sequence.name)`)

    const fkNew = await fresh.$queryRawUnsafe('PRAGMA main.foreign_key_check')
    const fkOld = await fresh.$queryRawUnsafe('PRAGMA old.foreign_key_check')
    if (fkNew.length > fkOld.length) throw new Error(`copy introduced ${fkNew.length - fkOld.length} foreign key violation(s)`)

    const integrity = await fresh.$queryRawUnsafe('PRAGMA main.integrity_check')
    if (integrity[0]?.integrity_check !== 'ok') throw new Error(`integrity check failed: ${JSON.stringify(integrity)}`)

    await fresh.$executeRawUnsafe('DETACH DATABASE old')
    log(`copied ${oldTables.length} tables`)
    ok = true
  } catch (err) {
    log(`ERROR: ${err instanceof Error ? err.message : err}`)
  } finally {
    await fresh.$disconnect()
  }

  if (!ok) {
    fs.rmSync(tmpPath, { force: true })
    log('the original database was left untouched')
    return 2
  }

  // ── 4. Swap files, keeping the original ───────────────────────────────────
  // Named so docker-entrypoint.sh's rolling-backup rotation (<name>.*.bak)
  // never deletes it.
  const keep = dbPath.replace(/\.db$/, '') + '-pre-baseline.bak'
  fs.renameSync(dbPath, keep)
  fs.renameSync(tmpPath, dbPath)
  log(`done — original kept at ${keep}`)
  return 0
}

main().then(
  code => process.exit(code),
  err => {
    log(`ERROR: ${err instanceof Error ? err.stack : err}`)
    process.exit(2)
  },
)
