// Saving a cost from the add/edit sheet. One form covers both kinds: "Yearly"
// with a due month is a yearly bill (annualExpense); anything else is a
// regular cost (expense). Changing kinds moves the record across: a new row of
// the new kind, and the old one deleted.

import type { Db } from './db'
import { insertRow, updateRow, deleteRow } from './mutate'

export type CostKind = 'regular' | 'annual'
export type Freq = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface CostDraft {
  name:  string
  cat:   string
  amt:   number
  freq:  Freq
  /** 1–12 when it's due in a particular month (yearly only). */
  month: number | null
}

/** Which kind a draft is saved as. */
export function kindOf(d: Pick<CostDraft, 'freq' | 'month'>): CostKind {
  return d.freq === 'yearly' && d.month !== null ? 'annual' : 'regular'
}

/** Saves a draft; `existing` is the record being changed, if any. Returns the saved record's id and kind. */
export async function saveCost(db: Db, existing: { id: string; kind: CostKind } | null, d: CostDraft): Promise<{ id: string; kind: CostKind }> {
  const kind = kindOf(d)
  const base = { name: d.name.trim(), cat: d.cat, amt: d.amt }
  if (existing && existing.kind === kind) {
    if (kind === 'annual') await updateRow(db, 'annualExpense', existing.id, { ...base, month: d.month! })
    else await updateRow(db, 'expense', existing.id, { ...base, freq: d.freq })
    return { id: existing.id, kind }
  }
  const id = kind === 'annual'
    ? await insertRow(db, 'annualExpense', { ...base, month: d.month! })
    : await insertRow(db, 'expense', { ...base, freq: d.freq })
  if (existing) await removeCost(db, existing)
  return { id, kind }
}

export async function removeCost(db: Db, c: { id: string; kind: CostKind }): Promise<void> {
  await deleteRow(db, c.kind === 'annual' ? 'annualExpense' : 'expense', c.id)
}
