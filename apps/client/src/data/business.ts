// Business income (core/businessIncome.ts): added, changed and removed
// through mutate.ts.

import type { Db } from './db'
import { deleteRow, insertRow, updateRow } from './mutate'

export interface BusinessDraft {
  person:    'p1' | 'p2'
  name:      string | null
  amount:    number
  growthPct: number
  startYear: number
  endYear:   number | null
}

/** Checks a draft; returns a problem in plain words, or null. */
export function checkBusiness(d: BusinessDraft, year: number): string | null {
  if (d.name !== null && d.name.length > 60) return 'Keep the name to 60 characters.'
  if (!(Number.isFinite(d.amount) && d.amount >= 0 && d.amount <= 5_000_000)) return 'Enter the profit a year, up to $5,000,000.'
  if (!(Number.isFinite(d.growthPct) && d.growthPct >= -10 && d.growthPct <= 20)) return 'Enter growth between −10% and 20% a year.'
  if (!(Number.isInteger(d.startYear) && d.startYear >= year - 20 && d.startYear <= year + 40)) return `Enter the year it starts (${year - 20} to ${year + 40}).`
  if (d.endYear !== null && !(Number.isInteger(d.endYear) && d.endYear >= d.startYear && d.endYear <= year + 60)) return 'The last year can’t be before the first.'
  return null
}

/** Adds (id null) or changes a business. Returns a problem in plain words, or null. */
export async function saveBusiness(db: Db, id: string | null, d: BusinessDraft, year: number = new Date().getFullYear()): Promise<string | null> {
  const draft = { ...d, name: d.name?.trim() || null }
  const problem = checkBusiness(draft, year)
  if (problem) return problem
  const row = { ...draft, kind: 'business' }
  if (id) await updateRow(db, 'incomeSource', id, row)
  else await insertRow(db, 'incomeSource', row)
  return null
}

export const removeBusiness = (db: Db, id: string) => deleteRow(db, 'incomeSource', id)
