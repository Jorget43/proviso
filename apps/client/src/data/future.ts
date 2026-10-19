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
  cashBufferMonths?: number  // months of spending kept as cash before investing
  funPct?:       number      // % of what's above the safety net spent on fun
  lifeStagesOn?: boolean     // costs follow ages (lifeStages.ts)
  childLeavesHomeAge?: number
  propGrowth:    number
  horizonAge:    number   // look ahead until the younger adult is this age
  schoolFeesOn:  boolean
  /** School fee rules (schema v8): % off a 2nd, 3rd, 4th+ child's tuition, a yearly family fee, an entry fee. */
  sfSib2Pct?:    number
  sfSib3Pct?:    number
  sfSib4Pct?:    number
  sfFamilyFee?:  number
  sfEntryFee?:   number
  /** Monte Carlo range (schema v10; core/uncertainty.ts): shown or not, % in growth assets, the glide path. */
  showRange?:      boolean | null
  growthPct?:      number
  glidePath?:      boolean
  glideTargetPct?: number
  /** Income from savings and investments (schema v11; core/investmentIncome.ts). */
  cashRate?:           number
  dividendYield?:      number
  frankedPct?:         number
  person1InvestShare?: number
}

/** Where the household lives: typical costs differ outside the capital cities. */
export const saveRegional = (db: Db, regional: boolean) => saveSettings(db, 'householdSettings', { regional })

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
