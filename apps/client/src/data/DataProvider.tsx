// Gives screens the household data and the ways to change it. Every change
// goes through src/data/mutate.ts and then reloads, so screens always show
// what's stored.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Db } from './db'
import { openHouseholdDb } from './open'
import { loadHousehold, type HouseholdData } from './household'
import * as mutate from './mutate'
import { importHousehold, type ImportResult } from './importExport'

interface DataContext {
  household: HouseholdData
  /** Runs a change against the database, then reloads. */
  change:    (fn: (db: Db, m: typeof mutate) => Promise<unknown>) => Promise<void>
  importFile: (json: unknown) => Promise<ImportResult>
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

  useEffect(() => {
    let alive = true
    openHouseholdDb()
      .then(async d => { const h = await loadHousehold(d); if (alive) { setDb(d); setHousehold(h) } })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [])

  const reload = useCallback(async (d: Db) => setHousehold(await loadHousehold(d)), [])

  const value = useMemo<DataContext | null>(() => (db && household ? {
    household,
    change: async fn => { await fn(db, mutate); await reload(db) },
    importFile: async json => { const r = await importHousehold(db, json); await reload(db); return r },
  } : null), [db, household, reload])

  if (error) return <>{failed(error)}</>
  if (!value) return <>{loading}</>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
