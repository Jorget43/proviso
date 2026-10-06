// Changes made from the Future screen: the projection's assumptions, the
// retirement income goal, and one-off costs. All through mutate.ts.

import type { Db } from './db'
import { insertRow, updateRow, deleteRow, saveSettings } from './mutate'

export interface Assumptions {
  person1Growth: number
  person2Growth: number
  expInfl:       number
  investReturn:  number
  savingsRate:   number
  propGrowth:    number
  projYears:     number
  schoolFeesOn:  boolean
}

export async function saveAssumptions(db: Db, a: Assumptions, retirementIncome: number): Promise<void> {
  // One inflation figure in the app: the near-term rate follows the long-run one.
  await saveSettings(db, 'projectionSettings', { ...a, expInflNear: a.expInfl })
  await saveSettings(db, 'superSettings', { desiredRetirementIncome: retirementIncome })
}

export interface OneOffDraft { name: string; amt: number; year: number }

export async function saveOneOff(db: Db, id: string | null, d: OneOffDraft): Promise<string> {
  const row = { name: d.name.trim(), amt: d.amt, year: d.year }
  if (id) { await updateRow(db, 'oneOff', id, row); return id }
  return insertRow(db, 'oneOff', row)
}

export const removeOneOff = (db: Db, id: string) => deleteRow(db, 'oneOff', id)
