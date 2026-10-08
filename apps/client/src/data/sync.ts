// Sync on this device (docs/architecture.md, D3–D5; protocol in @proviso/sync).
//
// While sync is on, every write through mutate.ts also records one change
// per field written, stamped by this device's hybrid logical clock, in an
// outbox. syncNow() seals the outbox into envelopes, pushes them to the
// relay, then pulls what other devices sent and applies it: per field, the
// latest edit wins.
//
// Bookkeeping lives in four device-local tables beside the household's —
// never exported, backed up or synced:
//   _syncMeta     relay address, last relay sequence seen, clock, node id
//   _syncField    the timestamp of what each field currently holds
//   _syncOutbox   changes made here, not yet accepted by the relay
//   _syncPending  received changes that can't be applied yet (a row still
//                 missing required fields, or a table/column from a newer
//                 app version); retried on every sync, never thrown away
//
// The household key never comes here: callers pass the derived keys.

import { sql, getTableColumns, eq, and, gt, count, asc, lte, type SQL } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { HOUSEHOLD_TABLES, SCHEMA_VERSION } from '@proviso/core/schema'
import { formatHlc, parseHlc, initialClock, tick, receive, ClockError, type Clock } from '@proviso/sync/hlc'
import { seal, open, changesFor, winners, byRow, fieldKey, type Change, type SyncKeys } from '@proviso/sync/messages'
import type { RelayClient } from '@proviso/sync/relay'
import type { Db } from './db'

// The union of table types defeats Drizzle's generics; rows are typed where read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (db: Db) => db as any

const syncMeta = sqliteTable('_syncMeta', { key: text('key').primaryKey(), value: text('value').notNull() })
const syncField = sqliteTable('_syncField', { tbl: text('tbl').notNull(), row: text('row').notNull(), col: text('col').notNull(), hlc: text('hlc').notNull() })
const syncOutbox = sqliteTable('_syncOutbox', { hlc: text('hlc').primaryKey(), tbl: text('tbl').notNull(), row: text('row').notNull(), col: text('col').notNull(), value: text('value').notNull() })
const syncPending = sqliteTable('_syncPending', {
  hlc: text('hlc').primaryKey(), tbl: text('tbl').notNull(), row: text('row').notNull(), col: text('col').notNull(), value: text('value').notNull(), schema: integer('schema').notNull(),
})

const DDL = [
  'CREATE TABLE IF NOT EXISTS _syncMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS _syncField (tbl TEXT NOT NULL, row TEXT NOT NULL, col TEXT NOT NULL, hlc TEXT NOT NULL, PRIMARY KEY (tbl, row, col)) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS _syncOutbox (hlc TEXT PRIMARY KEY, tbl TEXT NOT NULL, row TEXT NOT NULL, col TEXT NOT NULL, value TEXT NOT NULL) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS _syncPending (hlc TEXT PRIMARY KEY, tbl TEXT NOT NULL, row TEXT NOT NULL, col TEXT NOT NULL, value TEXT NOT NULL, schema INTEGER NOT NULL) WITHOUT ROWID',
]

/** Creates the bookkeeping tables (idempotent). Run when the database opens. */
export async function ensureSyncTables(db: Db): Promise<void> {
  for (const s of DDL) await db.run(sql.raw(s))
}

// ── Meta ─────────────────────────────────────────────────────────────────────

async function getMeta(db: Db, key: string): Promise<string | null> {
  const r = await anyDb(db).select().from(syncMeta).where(eq(syncMeta.key, key)) as { value: string }[]
  return r[0]?.value ?? null
}
async function setMeta(db: Db, key: string, value: string | null): Promise<void> {
  if (value === null) await anyDb(db).delete(syncMeta).where(eq(syncMeta.key, key))
  else await anyDb(db).insert(syncMeta).values({ key, value }).onConflictDoUpdate({ target: syncMeta.key, set: { value } })
}
async function countOf(db: Db, t: typeof syncOutbox | typeof syncPending, where?: SQL): Promise<number> {
  const r = await anyDb(db).select({ n: count() }).from(t).where(where) as { n: number }[]
  return Number(r[0]?.n ?? 0)
}

export interface SyncState {
  relay:        string
  lastSeq:      number
  lastSyncedAt: string | null
  /** Changes made here that the relay hasn't accepted yet. */
  unsent:       number
  /** Received changes waiting for something (often: a newer app version). */
  waiting:      number
  /** Another device runs a newer version of the data; this one should update. */
  needsUpdate:  boolean
}

/** Null when sync is off on this device. */
export async function syncState(db: Db): Promise<SyncState | null> {
  const relay = await getMeta(db, 'relay')
  if (!relay) return null
  return {
    relay,
    lastSeq: Number(await getMeta(db, 'lastSeq') ?? 0),
    lastSyncedAt: await getMeta(db, 'lastSyncedAt'),
    unsent: await countOf(db, syncOutbox),
    waiting: await countOf(db, syncPending),
    needsUpdate: (await countOf(db, syncPending, gt(syncPending.schema, SCHEMA_VERSION))) > 0,
  }
}

// ── Clock ────────────────────────────────────────────────────────────────────

function randomNode(): string {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('')
}

async function loadClock(db: Db): Promise<Clock> {
  const saved = await getMeta(db, 'clock')
  if (saved) return parseHlc(saved)
  let node = await getMeta(db, 'node')
  if (!node) { node = randomNode(); await setMeta(db, 'node', node) }
  return initialClock(node)
}

// ── Batched writes ───────────────────────────────────────────────────────────

const CHUNK = 100
const chunks = <T>(xs: T[]): T[][] => Array.from({ length: Math.ceil(xs.length / CHUNK) }, (_, i) => xs.slice(i * CHUNK, (i + 1) * CHUNK))

async function setFields(db: Db, cs: Change[]): Promise<void> {
  for (const part of chunks(cs)) {
    await anyDb(db).insert(syncField).values(part.map(c => ({ tbl: c.table, row: c.row, col: c.column, hlc: c.hlc })))
      .onConflictDoUpdate({ target: [syncField.tbl, syncField.row, syncField.col], set: { hlc: sql`excluded.hlc` }, setWhere: sql`excluded.hlc > ${syncField.hlc}` })
  }
}

type Waiting = { change: Change; schema: number }

async function pend(db: Db, cs: Waiting[]): Promise<void> {
  for (const part of chunks(cs)) {
    await anyDb(db).insert(syncPending)
      .values(part.map(({ change: c, schema }) => ({ hlc: c.hlc, tbl: c.table, row: c.row, col: c.column, value: JSON.stringify(c.value), schema })))
      .onConflictDoNothing()
  }
}

// ── Recording local writes (called by mutate.ts) ─────────────────────────────

interface Write { table: string; row: string; values: Record<string, unknown> }

async function record(db: Db, writes: Write[], now: number): Promise<void> {
  let clock = await loadClock(db)
  const stamp = () => formatHlc(clock = tick(clock, now))
  const changes = writes.flatMap(w => changesFor(w.table, w.row, w.values, stamp))
  if (!changes.length) return
  for (const part of chunks(changes)) {
    await anyDb(db).insert(syncOutbox).values(part.map(c => ({ hlc: c.hlc, tbl: c.table, row: c.row, col: c.column, value: JSON.stringify(c.value) })))
  }
  await setFields(db, changes)
  await setMeta(db, 'clock', formatHlc(clock))
}

/** Records a write made through mutate.ts, when sync is on. */
export async function recordWrite(db: Db, table: string, row: string, values: Record<string, unknown>, now: number = Date.now()): Promise<void> {
  if (!(await getMeta(db, 'relay'))) return
  await record(db, [{ table, row, values }], now)
}

// ── Applying changes from other devices ──────────────────────────────────────

const columnsOf = (table: string): Record<string, unknown> | null => {
  const t = (HOUSEHOLD_TABLES as Record<string, unknown>)[table]
  return t ? getTableColumns(t as Parameters<typeof getTableColumns>[0]) : null
}

async function currentHlcs(db: Db, changes: Change[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const rows = new Map<string, { table: string; row: string }>()
  for (const c of changes) rows.set(`${c.table}\u0000${c.row}`, c)
  for (const { table, row } of rows.values()) {
    const fields = await anyDb(db).select().from(syncField).where(and(eq(syncField.tbl, table), eq(syncField.row, row))) as { col: string; hlc: string }[]
    for (const f of fields) out.set(fieldKey({ table, row, column: f.col }), f.hlc)
  }
  return out
}

/** Applies received changes (plus anything still waiting); returns how many fields changed here. */
export async function applyChanges(db: Db, incoming: Waiting[], now: number = Date.now()): Promise<number> {
  const waiting = await anyDb(db).select().from(syncPending) as { hlc: string; tbl: string; row: string; col: string; value: string; schema: number }[]
  await anyDb(db).delete(syncPending)
  const all: Waiting[] = [
    ...waiting.map(p => ({ change: { hlc: p.hlc, table: p.tbl, row: p.row, column: p.col, value: JSON.parse(p.value) }, schema: Number(p.schema) })),
    ...incoming,
  ]
  if (!all.length) return 0
  const schemaOf = new Map(all.map(x => [x.change.hlc, x.schema]))
  const later = (c: Change): Waiting => ({ change: c, schema: schemaOf.get(c.hlc) ?? SCHEMA_VERSION })

  // Move this device's clock past everything seen, so its next edit orders after them.
  const newest = all.reduce((m, x) => (x.change.hlc > m ? x.change.hlc : m), '')
  try {
    await setMeta(db, 'clock', formatHlc(receive(await loadClock(db), parseHlc(newest), now)))
  } catch (e) {
    if (!(e instanceof ClockError)) throw e   // a far-future clock: apply, but don't follow it
  }

  const current = await currentHlcs(db, all.map(x => x.change))
  const win = winners(all.map(x => x.change), k => current.get(k))
  const waitAgain: Waiting[] = []
  let applied = 0

  for (const r of byRow(win)) {
    const cols = columnsOf(r.table)
    const known = r.changes.filter(c => cols !== null && c.column in cols)
    for (const c of r.changes) if (!known.includes(c)) waitAgain.push(later(c))
    if (!known.length) continue
    const table = (HOUSEHOLD_TABLES as Record<string, { id: unknown }>)[r.table]
    const values = Object.fromEntries(known.map(c => [c.column, c.value]))
    try {
      const exists = (await anyDb(db).select({ id: table.id }).from(table).where(eq(table.id as never, r.row))).length > 0
      if (exists) await anyDb(db).update(table).set(values).where(eq(table.id as never, r.row))
      else await anyDb(db).insert(table).values({ ...values, id: r.row })
    } catch {
      // Most often a new row whose other fields are still on their way.
      for (const c of known) waitAgain.push(later(c))
      continue
    }
    await setFields(db, known)
    applied += known.length
  }
  if (waitAgain.length) await pend(db, waitAgain)
  return applied
}

// ── Turning sync on and off ──────────────────────────────────────────────────

/** Turns sync on for the household already on this device: everything in it becomes changes to send. */
export async function startSync(db: Db, relay: string, now: number = Date.now()): Promise<void> {
  await clearSync(db)
  const writes: Write[] = []
  for (const [name, t] of Object.entries(HOUSEHOLD_TABLES)) {
    for (const row of await anyDb(db).select().from(t) as { id: string }[]) writes.push({ table: name, row: row.id, values: row })
  }
  await record(db, writes, now)
  await setMeta(db, 'relay', relay)
  await setMeta(db, 'lastSeq', '0')
}

/** Readies this device to join a household: its own household data is removed, then everything comes from the relay. */
export async function prepareJoin(db: Db, relay: string): Promise<void> {
  await clearSync(db)
  for (const t of Object.values(HOUSEHOLD_TABLES)) await anyDb(db).delete(t)
  await setMeta(db, 'relay', relay)
  await setMeta(db, 'lastSeq', '0')
}

/** Turns sync off on this device. The household stays here, and on the relay for the other devices. */
export async function stopSync(db: Db): Promise<void> {
  await clearSync(db)
}

async function clearSync(db: Db): Promise<void> {
  const node = await getMeta(db, 'node')
  for (const t of [syncMeta, syncField, syncOutbox, syncPending]) await anyDb(db).delete(t)
  if (node) await setMeta(db, 'node', node)
}

// ── Syncing ──────────────────────────────────────────────────────────────────

export interface SyncResult { sent: number; received: number }

/** Sends what's waiting, then fetches and applies what other devices sent. */
export async function syncNow(db: Db, relay: RelayClient, keys: SyncKeys, now: () => number = Date.now): Promise<SyncResult> {
  if (!(await getMeta(db, 'relay'))) return { sent: 0, received: 0 }

  const outbox = await anyDb(db).select().from(syncOutbox).orderBy(asc(syncOutbox.hlc)) as { hlc: string; tbl: string; row: string; col: string; value: string }[]
  if (outbox.length) {
    const changes: Change[] = outbox.map(o => ({ hlc: o.hlc, table: o.tbl, row: o.row, column: o.col, value: JSON.parse(o.value) }))
    // Envelopes of at most a few hundred changes each.
    for (let i = 0; i < changes.length; i += 400) await relay.push(seal(changes.slice(i, i + 400), keys.enc, SCHEMA_VERSION))
    await anyDb(db).delete(syncOutbox).where(lte(syncOutbox.hlc, outbox[outbox.length - 1].hlc))
  }

  let since = Number(await getMeta(db, 'lastSeq') ?? 0)
  let received = 0
  for (;;) {
    const page = await relay.pull(since)
    const incoming = page.envelopes.flatMap(e => open(e, keys.enc).map(change => ({ change, schema: e.schema })))
    received += await applyChanges(db, incoming, now())
    if (page.envelopes.length) since = page.envelopes[page.envelopes.length - 1].seq
    await setMeta(db, 'lastSeq', String(since))
    if (!page.more) break
  }
  await setMeta(db, 'lastSyncedAt', new Date(now()).toISOString())
  return { sent: outbox.length, received }
}
