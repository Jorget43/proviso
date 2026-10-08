// The relay's storage: per household, the hash of its access key and an
// append-only list of envelopes numbered as they arrive. Ciphertext only —
// nothing here can be read without the household key, which the relay never
// has (docs/architecture.md, D5).

import { DatabaseSync } from 'node:sqlite'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { Envelope } from '@proviso/sync/messages'
import type { StoredEnvelope, PullResult } from '@proviso/sync/relay'

const hash = (accessKey: string) => createHash('sha256').update(accessKey).digest()

export type Access = 'ok' | 'unknown' | 'denied'

export class Store {
  private db: DatabaseSync

  constructor(file: string) {
    this.db = new DatabaseSync(file)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS household (
        id        TEXT PRIMARY KEY,
        authHash  BLOB NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS envelope (
        household TEXT    NOT NULL,
        seq       INTEGER NOT NULL,
        tbl       TEXT    NOT NULL,
        v         INTEGER NOT NULL,
        schema    INTEGER NOT NULL,
        nonce     TEXT    NOT NULL,
        data      TEXT    NOT NULL,
        receivedAt TEXT   NOT NULL,
        PRIMARY KEY (household, seq)
      ) WITHOUT ROWID;
    `)
  }

  close() { this.db.close() }

  /** Whether this access key opens this household. */
  access(household: string, accessKey: string): Access {
    const row = this.db.prepare('SELECT authHash FROM household WHERE id = ?').get(household) as { authHash: Uint8Array } | undefined
    if (!row) return 'unknown'
    const want = Buffer.from(row.authHash)
    const got = hash(accessKey)
    return want.length === got.length && timingSafeEqual(want, got) ? 'ok' : 'denied'
  }

  /** Appends envelopes (registering the household on its first push). Returns the last sequence number. */
  append(household: string, accessKey: string, envelopes: Envelope[], now = new Date()): number {
    const at = now.toISOString()
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.prepare('INSERT OR IGNORE INTO household (id, authHash, createdAt) VALUES (?, ?, ?)').run(household, hash(accessKey), at)
      const { last } = this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS last FROM envelope WHERE household = ?').get(household) as { last: number }
      const insert = this.db.prepare('INSERT INTO envelope (household, seq, tbl, v, schema, nonce, data, receivedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      let seq = last
      for (const e of envelopes) insert.run(household, ++seq, e.table, e.v, e.schema, e.nonce, e.data, at)
      this.db.exec('COMMIT')
      return seq
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  pull(household: string, since: number, limit: number): PullResult {
    const rows = this.db.prepare('SELECT seq, tbl, v, schema, nonce, data FROM envelope WHERE household = ? AND seq > ? ORDER BY seq LIMIT ?')
      .all(household, since, limit + 1) as { seq: number; tbl: string; v: number; schema: number; nonce: string; data: string }[]
    const more = rows.length > limit
    const envelopes: StoredEnvelope[] = rows.slice(0, limit).map(r => ({ seq: r.seq, v: r.v, schema: r.schema, table: r.tbl, nonce: r.nonce, data: r.data }))
    const { last } = this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS last FROM envelope WHERE household = ?').get(household) as { last: number }
    return { envelopes, last: more ? envelopes[envelopes.length - 1].seq : last, more }
  }

  /** Deletes a household and everything it stored. */
  remove(household: string) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.prepare('DELETE FROM envelope WHERE household = ?').run(household)
      this.db.prepare('DELETE FROM household WHERE id = ?').run(household)
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }
}
