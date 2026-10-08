// "What if?": try changes to the long-term plan and see the effect before
// keeping them. A draft holds edited copies of the projection settings, the
// rent and home-purchase plan, and the work changes; previewing is a pure
// function of the household, so the Future figures recompute as you go and
// nothing is written until you keep the draft (through mutate.ts).

import { newId } from '@proviso/core/ids'
import type { Db } from './db'
import type { HouseholdData } from './household'
import { insertRow, updateRow, deleteRow, saveSettings } from './mutate'

type WorkPhase = HouseholdData['workPhases'][number]

export interface WhatIf {
  projection: HouseholdData['projection']
  rent:       HouseholdData['rent']
  workPhases: WorkPhase[]
}

export function startWhatIf(h: HouseholdData): WhatIf {
  return { projection: { ...h.projection }, rent: { ...h.rent }, workPhases: h.workPhases.map(w => ({ ...w })) }
}

/** The household as it would be with the draft kept. */
export function applyWhatIf(h: HouseholdData, w: WhatIf): HouseholdData {
  return { ...h, projection: w.projection, rent: w.rent, workPhases: w.workPhases }
}

/** Fields of `next` that differ from `prev` (settings rows: flat values only). */
function changed<T extends object>(prev: T, next: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(next) as (keyof T)[]) if (next[k] !== prev[k]) out[k] = next[k]
  return out
}

function workChanges(prev: WorkPhase[], next: WorkPhase[]) {
  const before = new Map(prev.map(p => [p.id, p]))
  const after = new Set(next.map(p => p.id))
  return {
    added:   next.filter(p => !before.has(p.id)),
    updated: next.filter(p => { const b = before.get(p.id); return b && (b.year !== p.year || b.days !== p.days || b.person !== p.person) }),
    removed: prev.filter(p => !after.has(p.id)),
  }
}

export function hasChanges(h: HouseholdData, w: WhatIf): boolean {
  const c = workChanges(h.workPhases, w.workPhases)
  return Object.keys(changed(h.projection, w.projection)).length > 0
    || Object.keys(changed(h.rent, w.rent)).length > 0
    || c.added.length + c.updated.length + c.removed.length > 0
}

/**
 * Adds a work change for `person`: the year after their last one, same days.
 * With no phases yet (full-time throughout, as the projection assumes) it
 * first records that, so the change doesn't reach back to earlier years.
 */
export function addWorkChange(w: WhatIf, person: 'p1' | 'p2', currentYear: number): WhatIf {
  const phase = (year: number, days: number): WorkPhase => ({ id: newId(), deletedAt: null, person, year, days })
  const mine = w.workPhases.filter(p => p.person === person).sort((a, b) => a.year - b.year)
  const last = mine[mine.length - 1]
  const added = last
    ? [phase(Math.max(currentYear, last.year) + 1, last.days)]
    : [phase(currentYear, 5), phase(currentYear + 1, 5)]
  return { ...w, workPhases: [...w.workPhases, ...added] }
}

/** Writes what the draft changed, and nothing else. */
export async function keepWhatIf(db: Db, h: HouseholdData, w: WhatIf): Promise<void> {
  const { id: _p, deletedAt: _pd, ...proj } = changed(h.projection, w.projection)
  if (Object.keys(proj).length) await saveSettings(db, 'projectionSettings', proj)
  const { id: _r, deletedAt: _rd, ...rent } = changed(h.rent, w.rent)
  if (Object.keys(rent).length) await saveSettings(db, 'rentSettings', rent)
  const c = workChanges(h.workPhases, w.workPhases)
  for (const p of c.removed) await deleteRow(db, 'workPhase', p.id)
  for (const p of c.updated) await updateRow(db, 'workPhase', p.id, { person: p.person, year: p.year, days: p.days })
  for (const p of c.added) await insertRow(db, 'workPhase', { person: p.person, year: p.year, days: p.days }, p.id)
}
