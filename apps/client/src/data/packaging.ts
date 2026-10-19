// Salary packaging items (core/packaging.ts): added, changed and removed
// through mutate.ts.

import { PACKAGE_KINDS, type PackageKind } from '@proviso/core/packaging'
import type { Db } from './db'
import { deleteRow, insertRow, updateRow } from './mutate'

export interface PackagedDraft {
  person:    'p1' | 'p2'
  kind:      PackageKind
  amount:    number
  carPrice:  number | null
  startYear: number
  endYear:   number | null
}

/** Checks a draft; returns a problem in plain words, or null. */
export function checkPackaged(d: PackagedDraft, year: number): string | null {
  if (!PACKAGE_KINDS.includes(d.kind)) return 'Choose a kind of packaging.'
  if (!(Number.isFinite(d.amount) && d.amount >= 0 && d.amount <= 200_000)) return 'Enter the amount a year, up to $200,000.'
  if (d.kind === 'evLease' && !(d.carPrice !== null && d.carPrice > 0 && d.carPrice <= 1_000_000)) return 'Enter the car’s price.'
  if (!(Number.isInteger(d.startYear) && d.startYear >= year - 20 && d.startYear <= year + 40)) return `Enter the year it starts (${year - 20} to ${year + 40}).`
  if (d.endYear !== null && !(Number.isInteger(d.endYear) && d.endYear >= d.startYear && d.endYear <= year + 60)) return 'The last year can’t be before the first.'
  return null
}

/** Adds (id null) or changes an item. Returns a problem in plain words, or null. */
export async function savePackaged(db: Db, id: string | null, d: PackagedDraft, year: number = new Date().getFullYear()): Promise<string | null> {
  const problem = checkPackaged(d, year)
  if (problem) return problem
  const row = { ...d, carPrice: d.kind === 'evLease' ? d.carPrice : null }
  if (id) await updateRow(db, 'packagedItem', id, row)
  else await insertRow(db, 'packagedItem', row)
  return null
}

export const removePackaged = (db: Db, id: string) => deleteRow(db, 'packagedItem', id)
