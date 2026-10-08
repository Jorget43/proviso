// Gives screens the household data and the ways to change it. Every change
// goes through src/data/mutate.ts and then reloads, so screens always show
// what's stored. When sync is on, changes are sent shortly after they're
// made, and other devices' changes are fetched every half minute and when
// the app comes back to the foreground.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import type { Db } from './db'
import { openHouseholdDb } from './open'
import { loadHousehold, type HouseholdData } from './household'
import * as mutate from './mutate'
import { importHousehold, restoreHousehold, eraseHousehold, type ImportResult } from './importExport'
import { decryptBackup, keyFromPhrase } from '@proviso/core/backup'
import { freshIdentity, saveIdentity, forgetIdentity } from './identity'
import { syncState, stopSync, type SyncState } from './sync'
import { turnOnSync, joinHousehold, recoverFromRelay, currentJoinCode, deleteFromRelay } from './syncRunner'
import { SyncScheduler, type SyncStatus } from './syncScheduler'

export interface SyncControls {
  /** Null when sync is off on this device. */
  state:  SyncState | null
  busy:   boolean
  /** The last sync's problem, in plain words; cleared by the next success. */
  error:  string | null
  now:    () => Promise<void>
  turnOn: (address: string) => Promise<void>
  join:   (code: string) => Promise<void>
  /** Gets a synced household back from its sync server with the recovery phrase (or the key from a password manager). */
  recover: (address: string, phrase: string | Uint8Array) => Promise<void>
  stop:   () => Promise<void>
  /** Removes the household from the sync server; every device stops syncing. */
  deleteFromServer: () => Promise<void>
  joinCode: () => Promise<string | null>
}

interface DataContext {
  household: HouseholdData
  /** Runs a change against the database, then reloads. */
  change:    (fn: (db: Db, m: typeof mutate) => Promise<unknown>) => Promise<void>
  /** Reads from the database without changing anything (e.g. to export). */
  read:      <T>(fn: (db: Db) => Promise<T>) => Promise<T>
  /** Brings in an export file (e.g. from the NAS). It becomes a new household on this device, with its own key. */
  importFile: (json: unknown) => Promise<ImportResult>
  /** Restores an encrypted backup with its recovery phrase (or the key itself, from a password manager). Throws a readable error if either is wrong. */
  restoreBackup: (file: unknown, phrase: string | Uint8Array) => Promise<ImportResult>
  /** Removes the household and its key from this device. */
  erase: () => Promise<void>
  sync:  SyncControls
}

const Ctx = createContext<DataContext | null>(null)

export function useHousehold(): DataContext {
  const c = useContext(Ctx)
  if (!c) throw new Error('useHousehold must be used inside <DataProvider>')
  return c
}

export function DataProvider({ children, loading, failed }: {
  children: ReactNode
  loading:  ReactNode
  failed:   (message: string) => ReactNode
}) {
  const [db, setDb] = useState<Db | null>(null)
  const [household, setHousehold] = useState<HouseholdData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncStatus>({ state: null, busy: false, error: null })
  const [scheduler, setScheduler] = useState<SyncScheduler | null>(null)

  useEffect(() => {
    let alive = true
    openHouseholdDb()
      .then(async d => {
        const h = await loadHousehold(d)
        if (!alive) return
        setDb(d); setHousehold(h)
        setScheduler(new SyncScheduler(d, setSync, async () => setHousehold(await loadHousehold(d))))
      })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!scheduler) return
    scheduler.start()
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void scheduler.run({ quiet: true }) })
    return () => { scheduler.stop(); sub.remove() }
  }, [scheduler])

  const reload = useCallback(async (d: Db) => setHousehold(await loadHousehold(d)), [])

  const notWhileSyncing = useCallback(async (d: Db) => {
    if (await syncState(d)) throw new Error('This household syncs with other devices. Turn sync off on this device first (Settings → Sync), so the others aren’t affected.')
  }, [])

  const value = useMemo<DataContext | null>(() => (db && household && scheduler ? {
    household,
    change: async fn => { await fn(db, mutate); await reload(db); scheduler.changed() },
    read: fn => fn(db),
    importFile: async json => {
      await notWhileSyncing(db)
      const r = await importHousehold(db, json)
      await saveIdentity(freshIdentity(r.householdId))
      await reload(db)
      return r
    },
    restoreBackup: async (file, phrase) => {
      const key = typeof phrase === 'string' ? keyFromPhrase(phrase) : phrase   // checks the words first
      const doc = decryptBackup(file, key)         // then that they open this backup
      await notWhileSyncing(db)
      const r = await restoreHousehold(db, doc)
      await saveIdentity({ householdId: r.householdId, key, phraseSaved: true })
      await reload(db)
      return r
    },
    erase: async () => {
      await stopSync(db)
      await eraseHousehold(db)
      await forgetIdentity()
      await reload(db)
      await scheduler.refresh()
    },
    sync: {
      ...sync,
      now: () => scheduler.run(),
      turnOn: async address => { await turnOnSync(db, address); await scheduler.refresh() },
      join: async code => {
        try { await joinHousehold(db, code) } finally { await reload(db); await scheduler.refresh() }
      },
      recover: async (address, phrase) => {
        const key = typeof phrase === 'string' ? keyFromPhrase(phrase) : phrase
        try { await recoverFromRelay(db, address, key) } finally { await reload(db); await scheduler.refresh() }
      },
      stop: async () => { await stopSync(db); await scheduler.refresh() },
      deleteFromServer: async () => { await deleteFromRelay(db); await scheduler.refresh() },
      joinCode: () => currentJoinCode(db),
    },
  } : null), [db, household, scheduler, reload, sync, notWhileSyncing])

  if (error) return <>{failed(error)}</>
  if (!value) return <>{loading}</>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
