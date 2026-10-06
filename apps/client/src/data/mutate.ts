// Every change to household data goes through these functions — nowhere else
// writes to the database. That's deliberate: in Phase 4 this is where each
// change also becomes an encrypted sync message (docs/architecture.md, D3),
// so a screen that wrote directly would silently never sync.
//
// Rules applied here: ids come from @proviso/core/ids, deletes only set
// deletedAt, and settings tables use their fixed id.

import { eq } from 'drizzle-orm'
import { newId } from '@proviso/core/ids'
import * as s from '@proviso/core/schema'
import type { Db } from './db'

type Name = s.HouseholdTableName
type Row<T extends Name> = s.HouseholdRow<T>
/** What a new row needs: everything except id/deletedAt (and anything with a default). */
export type NewRow<T extends Name> = Omit<s.HouseholdInsert<T>, 'id' | 'deletedAt'>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (db: Db) => db as any

export async function insertRow<T extends Name>(db: Db, name: T, values: NewRow<T>, id: string = newId()): Promise<string> {
  await anyDb(db).insert(s.HOUSEHOLD_TABLES[name]).values({ ...values, id, deletedAt: null })
  return id
}

export async function updateRow<T extends Name>(db: Db, name: T, id: string, patch: Partial<Omit<Row<T>, 'id' | 'deletedAt'>>): Promise<void> {
  if (Object.keys(patch).length === 0) return
  const t = s.HOUSEHOLD_TABLES[name]
  await anyDb(db).update(t).set(patch).where(eq(t.id, id))
}

/** Removes a row from view. The row stays (deletedAt set) so the deletion can sync. */
export async function deleteRow(db: Db, name: Name, id: string, now: Date = new Date()): Promise<void> {
  const t = s.HOUSEHOLD_TABLES[name]
  await anyDb(db).update(t).set({ deletedAt: now.toISOString() }).where(eq(t.id, id))
}

type SettingsName = 'householdSettings' | 'incomeSettings' | 'mortgageSettings' | 'childcareSettings'
  | 'projectionSettings' | 'superSettings' | 'rentSettings' | 'actualsSettings'

const SETTINGS_IDS: Record<SettingsName, string> = {
  householdSettings: s.SETTINGS_ID.household, incomeSettings: s.SETTINGS_ID.income,
  mortgageSettings: s.SETTINGS_ID.mortgage, childcareSettings: s.SETTINGS_ID.childcare,
  projectionSettings: s.SETTINGS_ID.projections, superSettings: s.SETTINGS_ID.super,
  rentSettings: s.SETTINGS_ID.rent, actualsSettings: s.SETTINGS_ID.actuals,
}

/** Changes settings fields, creating the settings row (with schema defaults) if it doesn't exist yet. */
export async function saveSettings<T extends SettingsName>(db: Db, name: T, patch: Partial<Omit<Row<T>, 'id' | 'deletedAt'>>): Promise<void> {
  const t = s.HOUSEHOLD_TABLES[name]
  const id = SETTINGS_IDS[name]
  await anyDb(db).insert(t).values({ ...patch, id, deletedAt: null })
    .onConflictDoUpdate({ target: t.id, set: { ...patch, deletedAt: null } })
}
