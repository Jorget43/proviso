import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Db } from '@/data/db'
import { loadHousehold } from '@/data/household'
import { futureView, homeView } from '@/data/views'
import { insertRow, updateRow, deleteRow, saveSettings } from '@/data/mutate'
import { startHousehold } from '@/data/setup'
import { startSync, prepareJoin, stopSync, syncNow, syncState, applyChanges } from '@/data/sync'
import { syncKeys, seal, type Envelope } from '@proviso/sync/messages'
import { formatHlc } from '@proviso/sync/hlc'
import { RelayError, type RelayClient, type StoredEnvelope } from '@proviso/sync/relay'
import { SCHEMA_VERSION } from '@proviso/core/schema'
import { estimateLivingCosts, buildStarterHousehold, type StarterAnswers } from '@proviso/core/starter'
import { migratedTestDb } from './testDb'

const NOW = new Date('2026-10-15T00:00:00Z')
const KEYS = syncKeys(new Uint8Array(32).map((_, i) => i + 1))
const RELAY = 'https://relay.example'

/** An in-memory relay with the real protocol's behaviour (append, page, sequence numbers). */
function memoryRelay() {
  const log: StoredEnvelope[] = []
  let down = false
  const client: RelayClient = {
    async health() {},
    async push(envs: Envelope[]) {
      if (down) throw new RelayError('Can’t reach the sync server.')
      for (const e of envs) log.push({ ...e, seq: log.length + 1 })
      return log.length
    },
    async pull(since: number) {
      if (down) throw new RelayError('Can’t reach the sync server.')
      const envelopes = log.filter(e => e.seq > since).slice(0, 3)   // small pages, to exercise paging
      const last = envelopes.at(-1)?.seq ?? log.length
      return { envelopes, last, more: last < log.length }
    },
    async remove() { log.length = 0 },
  }
  return { client, log, setDown: (d: boolean) => { down = d } }
}

const couple: StarterAnswers = {
  state: 'vic', regional: false,
  you: { name: 'Alex', age: 36, salary: 120_000, days: 5, hasHelp: true, helpBalance: 15_000, superBalance: 90_000 },
  partner: { name: 'Sam', age: 35, salary: 90_000, days: 4, hasHelp: false, helpBalance: 0, superBalance: 70_000 },
  children: [{ age: 2, childcareDays: 3 }], schoolType: 'government',
  home: { kind: 'mortgage', weeklyRent: 0, mortgageBalance: 500_000, mortgageRate: 6, mortgageYears: 25, homeValue: 900_000 },
  cars: 2, cash: 30_000, investments: 10_000,
}

let clock = NOW.getTime()
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(clock) })
afterEach(() => { vi.useRealTimers() })
/** Moves time on, so the next edit is later than the last. */
const later = (ms = 1_000) => { clock += ms; vi.setSystemTime(clock) }

async function twoDevices() {
  const relay = memoryRelay()
  const a = (await migratedTestDb()).db
  const b = (await migratedTestDb()).db
  await startHousehold(a, buildStarterHousehold(couple, estimateLivingCosts(couple), NOW))
  await startSync(a, RELAY)
  await syncNow(a, relay.client, KEYS)
  await prepareJoin(b, RELAY)
  await syncNow(b, relay.client, KEYS)
  return { relay, a, b }
}
const sync = (db: Db, relay: { client: RelayClient }) => syncNow(db, relay.client, KEYS)

describe('sync between two devices', () => {
  it('a joining device ends up with exactly the same household and the same figures', async () => {
    const { a, b } = await twoDevices()
    const [ha, hb] = [await loadHousehold(a), await loadHousehold(b)]
    expect(hb).toEqual(ha)
    expect(homeView(hb, NOW)).toEqual(homeView(ha, NOW))
    expect(futureView(hb, NOW).endNetWorth).toBe(futureView(ha, NOW).endNetWorth)
    expect((await syncState(b))).toMatchObject({ relay: RELAY, unsent: 0, waiting: 0, needsUpdate: false })
  })

  it('edits to different fields of the same row both survive', async () => {
    const { relay, a, b } = await twoDevices()
    const id = (await loadHousehold(a)).expenses[0].id
    later(); await updateRow(a, 'expense', id, { amt: 999 })
    later(); await updateRow(b, 'expense', id, { name: 'Renamed on B' })
    await sync(a, relay); await sync(b, relay); await sync(a, relay)
    for (const db of [a, b]) {
      expect((await loadHousehold(db)).expenses.find(e => e.id === id)).toMatchObject({ amt: 999, name: 'Renamed on B' })
    }
  })

  it('the same field edited on both: the later edit wins everywhere, whichever syncs first', async () => {
    const { relay, a, b } = await twoDevices()
    later(); await saveSettings(b, 'projectionSettings', { savingsRate: 30 })
    later(); await saveSettings(a, 'projectionSettings', { savingsRate: 50 })   // later
    await sync(a, relay); await sync(b, relay); await sync(a, relay)
    expect((await loadHousehold(a)).projection.savingsRate).toBe(50)
    expect((await loadHousehold(b)).projection.savingsRate).toBe(50)
  })

  it('a device whose clock is behind still orders its next edit after what it has seen', async () => {
    const { relay, a, b } = await twoDevices()
    later(60_000); await saveSettings(a, 'projectionSettings', { savingsRate: 40 })
    await sync(a, relay); await sync(b, relay)
    clock -= 30_000; vi.setSystemTime(clock)   // B's wall clock is behind A's
    await saveSettings(b, 'projectionSettings', { savingsRate: 45 })   // but this edit came after B saw A's
    await sync(b, relay); await sync(a, relay)
    expect((await loadHousehold(a)).projection.savingsRate).toBe(45)
  })

  it('new rows and deletions travel', async () => {
    const { relay, a, b } = await twoDevices()
    later(); const id = await insertRow(b, 'oneOff', { name: 'New car', amt: 30_000, year: 2028 })
    const gone = (await loadHousehold(b)).expenses[1].id
    later(); await deleteRow(b, 'expense', gone)
    await sync(b, relay); await sync(a, relay)
    const ha = await loadHousehold(a)
    expect(ha.oneOffs.map(o => o.id)).toEqual([id])
    expect(ha.expenses.some(e => e.id === gone)).toBe(false)
    expect(ha).toEqual(await loadHousehold(b))
  })

  it('changes made while the relay is down wait and go next time', async () => {
    const { relay, a, b } = await twoDevices()
    relay.setDown(true)
    later(); await saveSettings(a, 'householdSettings', { person2Name: 'Sammy' })
    await expect(sync(a, relay)).rejects.toThrow(RelayError)
    expect((await syncState(a))!.unsent).toBeGreaterThan(0)
    relay.setDown(false)
    await sync(a, relay); await sync(b, relay)
    expect((await loadHousehold(b)).settings.person2Name).toBe('Sammy')
    expect((await syncState(a))!.unsent).toBe(0)
  })

  it('a wrong household key can’t read anything', async () => {
    const { relay } = await twoDevices()
    const c = (await migratedTestDb()).db
    await prepareJoin(c, RELAY)
    await expect(syncNow(c, relay.client, syncKeys(new Uint8Array(32).fill(9)))).rejects.toThrow(/different household key/)
    expect((await loadHousehold(c)).exists).toBe(false)
  })

  it('stopping sync keeps the household here and stops recording', async () => {
    const { relay, a } = await twoDevices()
    await stopSync(a)
    expect(await syncState(a)).toBeNull()
    later(); await saveSettings(a, 'projectionSettings', { savingsRate: 77 })
    expect(relay.log.length).toBeGreaterThan(0)
    const before = relay.log.length
    await sync(a, relay)
    expect(relay.log.length).toBe(before)
    expect((await loadHousehold(a)).projection.savingsRate).toBe(77)
  })
})

describe('changes that can’t be applied yet are kept, never lost', () => {
  const at = (n: number) => formatHlc({ millis: NOW.getTime() + n, counter: 0, node: '00000000000000cc' })

  it('a new row whose required fields arrive later', async () => {
    const db = (await migratedTestDb()).db
    await prepareJoin(db, RELAY)
    await applyChanges(db, [{ change: { hlc: at(1), table: 'oneOff', row: 'r1', column: 'amt', value: 500 }, schema: SCHEMA_VERSION }])
    expect((await loadHousehold(db)).oneOffs).toEqual([])
    expect((await syncState(db))!.waiting).toBe(1)
    await applyChanges(db, [
      { change: { hlc: at(2), table: 'oneOff', row: 'r1', column: 'name', value: 'Holiday' }, schema: SCHEMA_VERSION },
      { change: { hlc: at(3), table: 'oneOff', row: 'r1', column: 'year', value: 2027 }, schema: SCHEMA_VERSION },
      { change: { hlc: at(4), table: 'oneOff', row: 'r1', column: 'deletedAt', value: null }, schema: SCHEMA_VERSION },
    ])
    expect((await loadHousehold(db)).oneOffs).toEqual([{ id: 'r1', deletedAt: null, name: 'Holiday', amt: 500, year: 2027 }])
    expect((await syncState(db))!.waiting).toBe(0)
  })

  it('a column or table from a newer app version waits (and asks for an update); the rest applies', async () => {
    const relay = memoryRelay()
    const db = (await migratedTestDb()).db
    await prepareJoin(db, RELAY)
    await relay.client.push(seal([
      { hlc: at(1), table: 'oneOff', row: 'r1', column: 'name', value: 'Boat' },
      { hlc: at(2), table: 'oneOff', row: 'r1', column: 'amt', value: 9_000 },
      { hlc: at(3), table: 'oneOff', row: 'r1', column: 'year', value: 2030 },
      { hlc: at(4), table: 'oneOff', row: 'r1', column: 'colour', value: 'blue' },
    ], KEYS.enc, SCHEMA_VERSION + 1))
    await relay.client.push(seal([{ hlc: at(5), table: 'futureThing', row: 'x', column: 'a', value: 1 }], KEYS.enc, SCHEMA_VERSION + 1))
    await syncNow(db, relay.client, KEYS)
    expect((await loadHousehold(db)).oneOffs).toMatchObject([{ name: 'Boat', amt: 9_000, year: 2030 }])
    expect(await syncState(db)).toMatchObject({ waiting: 2, needsUpdate: true })
  })
})
