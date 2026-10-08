import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createRelay } from '../src/server'
import { relayClient, RelayError, type FetchLike } from '@proviso/sync/relay'
import { syncKeys, seal, open, changesFor } from '@proviso/sync/messages'
import { formatHlc } from '@proviso/sync/hlc'

const HOUSEHOLD = '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b'
const KEY = new Uint8Array(32).map((_, i) => 7 * i)
const keys = syncKeys(KEY)
let n = 0
const stamp = () => formatHlc({ millis: 1_000, counter: n++, node: '00000000000000aa' })

let dir: string
let base: string
let close: () => Promise<void>

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'relay-'))
  const { server } = createRelay({ dataFile: join(dir, 'relay.db') })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => new Promise(r => server.close(() => r()))
})
afterEach(async () => {
  await close()
  rmSync(dir, { recursive: true, force: true })
})

const client = (auth = keys.auth, household = HOUSEHOLD) => relayClient(base, household, auth, fetch as unknown as FetchLike)

describe('relay', () => {
  it('answers health checks', async () => {
    await expect(client().health()).resolves.toBeUndefined()
  })

  it('stores what one device pushes and hands it to another, in order, as ciphertext only', async () => {
    const changes = [...changesFor('expense', 'row-1', { name: 'Groceries', amt: 250 }, stamp), ...changesFor('asset', 'row-2', { amt: 9_000 }, stamp)]
    const last = await client().push(seal(changes, keys.enc, 1))
    expect(last).toBe(2)

    const pulled = await client().pull(0)
    expect(pulled.envelopes.map(e => e.seq)).toEqual([1, 2])
    expect(pulled.last).toBe(2)
    expect(pulled.more).toBe(false)
    expect(pulled.envelopes.flatMap(e => open(e, keys.enc)).map(c => c.value).sort()).toEqual([250, 9_000, 'Groceries'])
    expect((await client().pull(2)).envelopes).toEqual([])

    // What's on disk can't be read without the household key.
    await close(); close = async () => {}
    const disk = readFileSync(join(dir, 'relay.db')).toString('latin1')
    for (const s of ['Groceries', 'row-1', keys.auth]) expect(disk).not.toContain(s)
  })

  it('pages long histories', async () => {
    const env = seal(changesFor('expense', 'r', { amt: 1 }, stamp), keys.enc, 1)[0]
    await client().push(Array(1_100).fill(env))
    const a = await client().pull(0)
    expect(a.envelopes).toHaveLength(500)
    expect(a.more).toBe(true)
    const b = await client().pull(a.last)
    const c = await client().pull(b.last)
    expect([a.last, b.last, c.last]).toEqual([500, 1_000, 1_100])
    expect(c.more).toBe(false)
  })

  it('the first push registers the household; another key is refused', async () => {
    const other = syncKeys(new Uint8Array(32).fill(1)).auth
    await client().push(seal(changesFor('expense', 'r', { amt: 1 }, stamp), keys.enc, 1))
    await expect(client(other).pull(0)).rejects.toMatchObject({ status: 403 })
    await expect(client(other).push(seal(changesFor('expense', 'r', { amt: 2 }, stamp), keys.enc, 1))).rejects.toThrow(RelayError)
    await expect(client(other).remove()).rejects.toMatchObject({ status: 403 })
    expect((await client().pull(0)).envelopes).toHaveLength(1)
  })

  it('an unknown household pulls nothing (a device joining before the first push)', async () => {
    expect(await client().pull(0)).toEqual({ envelopes: [], last: 0, more: false })
  })

  it('deleting the household removes everything it stored', async () => {
    await client().push(seal(changesFor('expense', 'r', { amt: 1 }, stamp), keys.enc, 1))
    await client().remove()
    expect(await client().pull(0)).toEqual({ envelopes: [], last: 0, more: false })
    // ...and the id is free again for a new key.
    const fresh = syncKeys(new Uint8Array(32).fill(3)).auth
    await expect(client(fresh).push(seal(changesFor('expense', 'r', { amt: 1 }, stamp), keys.enc, 1))).resolves.toBe(1)
  })

  it('refuses malformed requests', async () => {
    const post = (body: unknown, auth = `Bearer ${keys.auth}`) => fetch(`${base}/v1/households/${HOUSEHOLD}/envelopes`, {
      method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    expect((await post({ envelopes: [] })).status).toBe(400)
    expect((await post({ envelopes: [{ v: 1, schema: 1, table: 'drop table;', nonce: '', data: '' }] })).status).toBe(400)
    expect((await post({ envelopes: [{ v: 1, schema: 1, table: 'expense', nonce: '', data: '<script>' }] })).status).toBe(400)
    expect((await post({ envelopes: [{ v: 1, schema: 1, table: 'expense', nonce: '', data: '' }] }, 'Bearer short')).status).toBe(401)
    expect((await fetch(`${base}/v1/households/not-an-id/envelopes`)).status).toBe(404)
    expect((await fetch(`${base}/anything`)).status).toBe(404)
  })

  it('allows cross-origin calls with a bearer key (the web client)', async () => {
    const res = await fetch(`${base}/v1/health`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization')
  })
})
