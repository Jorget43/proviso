// Change messages and their encryption (docs/architecture.md, D3–D4).
//
// A change is one field of one row: (table, row id, column, value, hlc).
// Changes travel to the relay in envelopes, one per table per push. An
// envelope's table name is in clear (so a relay can enforce who may write
// what, D6); everything else, row ids included, is inside AES-256-GCM
// ciphertext. The table name, format version and schema version are bound
// to the ciphertext as associated data, so a relay can't relabel an
// envelope without it failing to open.
//
// The encryption key is derived from the household key with HKDF under its
// own info string, so sync, backups (core/backup.ts) and the relay access
// key never share a key.

import { gcm } from '@noble/ciphers/aes.js'
import { randomBytes, utf8ToBytes, bytesToUtf8, bytesToHex } from '@noble/ciphers/utils.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { toB64, fromB64 } from '@proviso/core/backup'
import { parseHlc } from './hlc'

/** The message format. Bumped only for a change old devices can't read. */
export const FORMAT_VERSION = 1

export type Value = string | number | boolean | null

export interface Change {
  hlc:    string
  table:  string
  row:    string
  column: string
  value:  Value
}

/** What the relay stores and hands back. */
export interface Envelope {
  v:      number   // FORMAT_VERSION
  schema: number   // the sender's SCHEMA_VERSION
  table:  string
  nonce:  string   // base64, 12 bytes
  data:   string   // base64 ciphertext of Change[] without the table (GCM tag included)
}

export class SyncDataError extends Error {
  constructor(message: string) { super(message); this.name = 'SyncDataError' }
}

export interface SyncKeys {
  /** Encrypts and opens envelopes. Never leaves the device. */
  enc:  Uint8Array
  /** Proves to the relay that a device belongs to the household (hex). The relay stores only its hash. */
  auth: string
  /**
   * The household's name on the relay, a UUID derived from the key: the
   * recovery phrase (or a saved key) plus the relay's address is enough to
   * find the household again, and the relay never learns the household id.
   */
  relayId: string
}

function uuidFrom(b: Uint8Array): string {
  const x = Uint8Array.from(b.slice(0, 16))
  x[6] = (x[6] & 0x0f) | 0x80   // version 8: custom
  x[8] = (x[8] & 0x3f) | 0x80   // RFC 9562 variant
  const h = bytesToHex(x)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function syncKeys(householdKey: Uint8Array): SyncKeys {
  if (householdKey.length !== 32) throw new SyncDataError('A household key is 32 bytes.')
  return {
    enc:  hkdf(sha256, householdKey, undefined, utf8ToBytes('proviso sync v1'), 32),
    auth: bytesToHex(hkdf(sha256, householdKey, undefined, utf8ToBytes('proviso relay auth v1'), 32)),
    relayId: uuidFrom(hkdf(sha256, householdKey, undefined, utf8ToBytes('proviso relay id v1'), 16)),
  }
}

const aad = (v: number, schema: number, table: string) => utf8ToBytes(`proviso-sync|${v}|${schema}|${table}`)

/** Seals changes into one envelope per table. */
export function seal(changes: Change[], key: Uint8Array, schema: number): Envelope[] {
  const byTable = new Map<string, Omit<Change, 'table'>[]>()
  for (const { table, ...rest } of changes) {
    if (!byTable.has(table)) byTable.set(table, [])
    byTable.get(table)!.push(rest)
  }
  return [...byTable].map(([table, list]) => {
    const nonce = randomBytes(12)
    const data = gcm(key, nonce, aad(FORMAT_VERSION, schema, table)).encrypt(utf8ToBytes(JSON.stringify(list)))
    return { v: FORMAT_VERSION, schema, table, nonce: toB64(nonce), data: toB64(data) }
  })
}

/** Opens an envelope. Throws SyncDataError when it can't be opened or isn't well formed. */
export function open(env: Envelope, key: Uint8Array): Change[] {
  if (env.v !== FORMAT_VERSION) throw new SyncDataError(`Sync message format ${env.v} is newer than this app understands.`)
  let plain: Uint8Array
  try {
    plain = gcm(key, fromB64(env.nonce), aad(env.v, env.schema, env.table)).decrypt(fromB64(env.data))
  } catch {
    throw new SyncDataError('A sync message couldn’t be opened: it was made with a different household key, or it was changed on the way.')
  }
  const list: unknown = JSON.parse(bytesToUtf8(plain))
  if (!Array.isArray(list)) throw new SyncDataError('A sync message is damaged.')
  return list.map(x => {
    const c = x as Partial<Change>
    const okValue = c.value === null || ['string', 'number', 'boolean'].includes(typeof c.value)
    if (typeof c.hlc !== 'string' || typeof c.row !== 'string' || typeof c.column !== 'string' || !okValue) {
      throw new SyncDataError('A sync message is damaged.')
    }
    parseHlc(c.hlc)
    return { hlc: c.hlc, table: env.table, row: c.row, column: c.column, value: c.value as Value }
  })
}

/** One change per field written, all sharing the next timestamps from `stamp`. */
export function changesFor(table: string, row: string, values: Record<string, unknown>, stamp: () => string): Change[] {
  return Object.entries(values)
    .filter(([column]) => column !== 'id')
    .map(([column, value]) => ({ hlc: stamp(), table, row, column, value: toValue(value) }))
}

function toValue(v: unknown): Value {
  if (v === undefined || v === null) return null
  if (typeof v === 'string' || typeof v === 'boolean') return v
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new SyncDataError('Only finite numbers can be synced.')
    return v
  }
  if (v instanceof Date) return v.toISOString()
  throw new SyncDataError(`A ${typeof v} value can’t be synced.`)
}

export const fieldKey = (c: Pick<Change, 'table' | 'row' | 'column'>) => `${c.table}\u0000${c.row}\u0000${c.column}`

/**
 * Latest edit wins, per field. Given incoming changes and the timestamp of
 * what each field currently holds (undefined: never written), returns the
 * changes that should be applied — at most one per field, the newest.
 */
export function winners(incoming: Change[], current: (key: string) => string | undefined): Change[] {
  const best = new Map<string, Change>()
  for (const c of incoming) {
    const k = fieldKey(c)
    const prev = best.get(k)
    if (!prev || c.hlc > prev.hlc) best.set(k, c)
  }
  return [...best.values()].filter(c => {
    const have = current(fieldKey(c))
    return have === undefined || c.hlc > have
  })
}

/** Groups changes by row, keeping table and row together. */
export function byRow(changes: Change[]): { table: string; row: string; values: Record<string, Value>; changes: Change[] }[] {
  const out = new Map<string, { table: string; row: string; values: Record<string, Value>; changes: Change[] }>()
  for (const c of changes) {
    const k = `${c.table}\u0000${c.row}`
    if (!out.has(k)) out.set(k, { table: c.table, row: c.row, values: {}, changes: [] })
    const r = out.get(k)!
    r.values[c.column] = c.value
    r.changes.push(c)
  }
  return [...out.values()]
}
