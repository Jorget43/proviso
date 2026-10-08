import { describe, it, expect } from 'vitest'
import { formatHlc, parseHlc, initialClock, tick, receive, MAX_DRIFT_MS, ClockError } from '../src/hlc'
import { syncKeys, seal, open, changesFor, winners, byRow, fieldKey, SyncDataError, FORMAT_VERSION, type Change } from '../src/messages'
import { normaliseRelayUrl, relayClient, RelayError, type FetchLike } from '../src/relay'
import { joinCode, parseJoinCode } from '../src/joinCode'

const NODE_A = '00000000000000aa'
const NODE_B = '00000000000000bb'
const KEY = new Uint8Array(32).map((_, i) => i)
const HOUSEHOLD = '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b'

describe('hybrid logical clock', () => {
  it('formats so that string order is time order', () => {
    const a = formatHlc({ millis: 9, counter: 0, node: NODE_B })
    const b = formatHlc({ millis: 10, counter: 0, node: NODE_A })
    const c = formatHlc({ millis: 10, counter: 1, node: NODE_A })
    expect([c, a, b].sort()).toEqual([a, b, c])
    expect(parseHlc(c)).toEqual({ millis: 10, counter: 1, node: NODE_A })
    expect(() => parseHlc('nope')).toThrow(ClockError)
  })

  it('ticks forward even when the wall clock stands still or goes back', () => {
    let c = initialClock(NODE_A)
    c = tick(c, 1000)
    expect(c).toMatchObject({ millis: 1000, counter: 0 })
    c = tick(c, 1000)
    expect(c).toMatchObject({ millis: 1000, counter: 1 })
    c = tick(c, 500) // clock went backwards
    expect(c).toMatchObject({ millis: 1000, counter: 2 })
    c = tick(c, 2000)
    expect(c).toMatchObject({ millis: 2000, counter: 0 })
  })

  it('a received timestamp moves the clock past it, so the next local change orders after it', () => {
    const mine = tick(initialClock(NODE_A), 1000)
    const theirs = { millis: 5000, counter: 3, node: NODE_B }
    const after = receive(mine, theirs, 1200)
    expect(after).toMatchObject({ millis: 5000, counter: 4, node: NODE_A })
    expect(formatHlc(tick(after, 1300)) > formatHlc(theirs)).toBe(true)
  })

  it('refuses a clock too far in the future', () => {
    expect(() => receive(initialClock(NODE_A), { millis: 1000 + MAX_DRIFT_MS + 1, counter: 0, node: NODE_B }, 1000)).toThrow(ClockError)
  })
})

describe('messages', () => {
  let n = 0
  const stamp = () => formatHlc({ millis: 1000, counter: n++, node: NODE_A })

  it('one change per field, never the id; dates become ISO strings', () => {
    const cs = changesFor('expense', 'r1', { id: 'r1', name: 'Rent', amt: 400, deletedAt: null, when: new Date('2026-01-02T00:00:00Z') }, stamp)
    expect(cs.map(c => [c.column, c.value])).toEqual([['name', 'Rent'], ['amt', 400], ['deletedAt', null], ['when', '2026-01-02T00:00:00.000Z']])
    expect(new Set(cs.map(c => c.hlc)).size).toBe(4)
    expect(() => changesFor('expense', 'r1', { amt: NaN }, stamp)).toThrow(SyncDataError)
  })

  it('seals one envelope per table with only the table name in clear, and opens them again', () => {
    const k = syncKeys(KEY)
    const cs: Change[] = [
      ...changesFor('expense', 'secret-row-id', { name: 'Groceries', amt: 250 }, stamp),
      ...changesFor('asset', 'a1', { name: 'Savings', amt: 10_000, isOffset: false }, stamp),
    ]
    const envs = seal(cs, k.enc, 1)
    expect(envs.map(e => e.table).sort()).toEqual(['asset', 'expense'])
    const wire = JSON.stringify(envs)
    for (const s of ['secret-row-id', 'Groceries', '250', 'Savings']) expect(wire).not.toContain(s)
    const byHlc = (a: Change, b: Change) => (a.hlc < b.hlc ? -1 : 1)
    expect(envs.flatMap(e => open(e, k.enc)).sort(byHlc)).toEqual([...cs].sort(byHlc))
  })

  it('refuses a wrong key, a relabelled table, a changed schema stamp and a newer format', () => {
    const k = syncKeys(KEY)
    const [env] = seal(changesFor('expense', 'r', { amt: 1 }, stamp), k.enc, 1)
    expect(() => open(env, syncKeys(new Uint8Array(32)).enc)).toThrow(SyncDataError)
    expect(() => open({ ...env, table: 'asset' }, k.enc)).toThrow(SyncDataError)
    expect(() => open({ ...env, schema: 2 }, k.enc)).toThrow(SyncDataError)
    expect(() => open({ ...env, v: FORMAT_VERSION + 1 }, k.enc)).toThrow(/newer/)
  })

  it('the relay id comes from the key: the same everywhere, a valid UUID, different per household', () => {
    const a = syncKeys(KEY).relayId
    expect(a).toBe(syncKeys(Uint8Array.from(KEY)).relayId)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(syncKeys(new Uint8Array(32)).relayId).not.toBe(a)
  })

  it('sync, relay access and backups use different keys', () => {
    const k = syncKeys(KEY)
    expect(k.auth).toMatch(/^[0-9a-f]{64}$/)
    expect(Buffer.from(k.enc).toString('hex')).not.toBe(k.auth)
    expect(Buffer.from(k.enc).toString('hex')).not.toBe(Buffer.from(KEY).toString('hex'))
  })
})

describe('merge: the latest edit wins, per field', () => {
  const at = (millis: number, node = NODE_A) => formatHlc({ millis, counter: 0, node })
  const ch = (column: string, value: Change['value'], hlc: string, row = 'r1'): Change => ({ hlc, table: 'expense', row, column, value })

  it('two people editing different fields both keep their edits', () => {
    const current = new Map<string, string>([[fieldKey(ch('amt', 0, '')), at(100)], [fieldKey(ch('name', '', '')), at(100)]])
    const w = winners([ch('amt', 300, at(200, NODE_A)), ch('name', 'Food', at(150, NODE_B))], k => current.get(k))
    expect(w.map(c => [c.column, c.value])).toEqual([['amt', 300], ['name', 'Food']])
  })

  it('an older incoming edit loses; among incoming, the newest wins; equal timestamps are a no-op', () => {
    const current = new Map([[fieldKey(ch('amt', 0, '')), at(300)]])
    expect(winners([ch('amt', 1, at(200))], k => current.get(k))).toEqual([])
    expect(winners([ch('amt', 1, at(300))], k => current.get(k))).toEqual([])
    const w = winners([ch('amt', 1, at(400)), ch('amt', 2, at(500)), ch('amt', 3, at(450))], k => current.get(k))
    expect(w.map(c => c.value)).toEqual([2])
  })

  it('the node id breaks a tie in the same millisecond, the same way on every device', () => {
    const a = ch('amt', 'from A', at(100, NODE_A))
    const b = ch('amt', 'from B', at(100, NODE_B))
    expect(winners([a, b], () => undefined)[0].value).toBe('from B')
    expect(winners([b, a], () => undefined)[0].value).toBe('from B')
  })

  it('groups by row for applying', () => {
    const rows = byRow([ch('amt', 1, at(1)), ch('name', 'x', at(2)), ch('amt', 5, at(3), 'r2')])
    expect(rows.map(r => [r.row, r.values])).toEqual([['r1', { amt: 1, name: 'x' }], ['r2', { amt: 5 }]])
  })
})

describe('relay addresses and join codes', () => {
  it('https only, except a local relay; tidies what was typed', () => {
    expect(normaliseRelayUrl('relay.example.net')).toBe('https://relay.example.net')
    expect(normaliseRelayUrl(' HTTPS://Nas.Example.net/sync/ ')).toBe('https://nas.example.net/sync')
    expect(normaliseRelayUrl('http://localhost:8787')).toBe('http://localhost:8787')
    expect(normaliseRelayUrl('http://nas.lan:8787')).toBeNull()
    expect(normaliseRelayUrl('ftp://x')).toBeNull()
    expect(normaliseRelayUrl('')).toBeNull()
  })

  it('a join code round-trips and rejects anything else', () => {
    const code = joinCode({ relay: 'https://relay.example.net', household: HOUSEHOLD, key: KEY })
    expect(parseJoinCode(`  ${code}\n`)).toEqual({ relay: 'https://relay.example.net', household: HOUSEHOLD, key: KEY })
    expect(parseJoinCode('hello')).toBeNull()
    expect(parseJoinCode(code.replace('k=', 'k=AA'))).toBeNull()
    expect(parseJoinCode(code.replace('v=1', 'v=2'))).toBeNull()
    expect(parseJoinCode(code.replace(encodeURIComponent('https://'), encodeURIComponent('http://')))).toBeNull()
  })
})

describe('relay client', () => {
  function fakeFetch(handler: (url: string, init?: Parameters<FetchLike>[1]) => { status: number; body?: unknown }): { fetch: FetchLike; calls: string[] } {
    const calls: string[] = []
    return {
      calls,
      fetch: async (url, init) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`)
        const r = handler(url, init)
        return { ok: r.status < 300, status: r.status, json: async () => r.body }
      },
    }
  }

  it('sends the access key and splits big pushes', async () => {
    const seen: string[] = []
    const f = fakeFetch((url, init) => {
      seen.push(init?.headers?.authorization ?? '')
      if (init?.method === 'POST') return { status: 200, body: { last: JSON.parse(init.body!).envelopes.length } }
      return { status: 200, body: { envelopes: [], last: 0, more: false } }
    })
    const c = relayClient('https://r.example', HOUSEHOLD, 'abc', f.fetch)
    const env = { v: 1, schema: 1, table: 't', nonce: '', data: '' }
    expect(await c.push(Array(1200).fill(env))).toBe(200)
    expect(f.calls.filter(x => x.startsWith('POST'))).toHaveLength(3)
    await c.pull(7)
    expect(f.calls.at(-1)).toBe(`GET https://r.example/v1/households/${HOUSEHOLD}/envelopes?since=7&limit=500`)
    expect(new Set(seen)).toEqual(new Set(['Bearer abc']))
  })

  it('explains failures in plain words', async () => {
    const down: FetchLike = async () => { throw new Error('ECONNREFUSED') }
    await expect(relayClient('https://r.example', HOUSEHOLD, 'k', down).health()).rejects.toThrow(/Can’t reach/)
    const denied = fakeFetch(() => ({ status: 401, body: { error: 'x' } }))
    await expect(relayClient('https://r.example', HOUSEHOLD, 'k', denied.fetch).pull(0)).rejects.toThrow(RelayError)
    const notOurs = fakeFetch(() => ({ status: 200, body: { hello: 1 } }))
    await expect(relayClient('https://r.example', HOUSEHOLD, 'k', notOurs.fetch).health()).rejects.toThrow(/isn’t a Proviso/)
    expect(() => relayClient('https://r.example', '../etc', 'k', notOurs.fetch)).toThrow(RelayError)
  })
})
