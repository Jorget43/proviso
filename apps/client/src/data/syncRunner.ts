// Device glue for sync: reads the household key from secure storage, derives
// the sync keys and talks to the relay with the platform's fetch. The logic
// itself is in sync.ts (tested in Node); this file only wires it up.

import { syncKeys } from '@proviso/sync/messages'
import { relayClient, normaliseRelayUrl, RelayError, type FetchLike } from '@proviso/sync/relay'
import { parseJoinCode, joinCode, type JoinInfo } from '@proviso/sync/joinCode'
import type { Db } from './db'
import { loadIdentity, saveIdentity } from './identity'
import { syncNow, syncState, startSync, prepareJoin, stopSync, type SyncResult } from './sync'

const fetchFn = ((url, init) => fetch(url, init)) as FetchLike

async function connection(relay: string) {
  const id = await loadIdentity()
  if (!id) throw new RelayError('This device has no household key yet.')
  const keys = syncKeys(id.key)
  return { id, keys, client: relayClient(relay, id.householdId, keys.auth, fetchFn) }
}

/** Syncs now if sync is on. Null when it's off. */
export async function runSync(db: Db): Promise<SyncResult | null> {
  const s = await syncState(db)
  if (!s) return null
  const { keys, client } = await connection(s.relay)
  return syncNow(db, client, keys)
}

/** Turns sync on with the household already here. Checks the address answers first. */
export async function turnOnSync(db: Db, address: string): Promise<SyncResult> {
  const relay = normaliseRelayUrl(address)
  if (!relay) throw new RelayError('Enter the sync server’s address, starting with https:// (for example, your NAS’s Tailscale address).')
  const { keys, client } = await connection(relay)
  await client.health()
  await startSync(db, relay)
  return syncNow(db, client, keys)
}

/** Joins the household in a scanned or pasted code. This device's own household data is replaced. */
export async function joinHousehold(db: Db, code: string): Promise<SyncResult> {
  const j = parseJoinCode(code)
  if (!j) throw new RelayError('That isn’t a Proviso join code. On the other device, open Settings → Sync → Add a device.')
  const keys = syncKeys(j.key)
  const client = relayClient(j.relay, j.household, keys.auth, fetchFn)
  await client.health()
  await prepareJoin(db, j.relay)
  // The other device already has the recovery phrase saved; it's the same household.
  await saveIdentity({ householdId: j.household, key: j.key, phraseSaved: true })
  return syncNow(db, client, keys)
}

/** The code another device scans to join. Holding it is holding the household: show it, never store it. */
export async function currentJoinCode(db: Db): Promise<string | null> {
  const s = await syncState(db)
  const id = await loadIdentity()
  if (!s || !id) return null
  const info: JoinInfo = { relay: s.relay, household: id.householdId, key: id.key }
  return joinCode(info)
}

/** Deletes the household from the sync server (every device stops syncing), and stops here. */
export async function deleteFromRelay(db: Db): Promise<void> {
  const s = await syncState(db)
  if (!s) return
  const { client } = await connection(s.relay)
  await client.remove()
  await stopSync(db)
}
