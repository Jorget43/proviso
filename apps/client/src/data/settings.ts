// Household settings changed from Settings: names and partner, rent,
// childcare. All through mutate.ts.

import { and, eq, isNull } from 'drizzle-orm'
import * as s from '@proviso/core/schema'
import { validateMemberNames } from '@proviso/core/members'
import { CHILDCARE_CAT, CHILDCARE_NAME } from '@proviso/core/budgetSummary'
import type { Db } from './db'
import { insertRow, saveSettings } from './mutate'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (db: Db) => db as any

/** Saves the names (and whether there's a partner). Returns an error in plain words, or null. */
export async function savePeople(db: Db, p: { person1Name: string; person2Name: string; partnerEnabled: boolean }): Promise<string | null> {
  const person1Name = p.person1Name.trim(), person2Name = p.person2Name.trim() || 'Partner'
  const invalid = validateMemberNames(person1Name, person2Name, p.partnerEnabled)
  if (invalid) return invalid
  // People are keyed p1/p2 everywhere, so a rename needs nothing else changed.
  // HELP debts are matched by name, so their rows follow the new name.
  const old = await anyDb(db).select().from(s.householdSettings).where(isNull(s.householdSettings.deletedAt)) as s.HouseholdRow<'householdSettings'>[]
  await saveSettings(db, 'householdSettings', { person1Name, person2Name, partnerEnabled: p.partnerEnabled })
  if (old[0]) {
    for (const [from, to] of [[old[0].person1Name, person1Name], [old[0].person2Name, person2Name]] as const) {
      if (from !== to) await anyDb(db).update(s.debt).set({ name: `${to} HELP debt` }).where(and(isNull(s.debt.deletedAt), eq(s.debt.name, `${from} HELP debt`)))
    }
  }
  return null
}

export async function saveRent(db: Db, r: { enabled: boolean; monthlyRent: number; annualIncreaseRate: number }): Promise<void> {
  await saveSettings(db, 'rentSettings', r.enabled ? r : { enabled: false, purchasePlanEnabled: false })
}

/**
 * Childcare: on/off and its details. While it's on, the budget shows a
 * "Childcare" line worked out after the subsidy (budgetSummary.ts); the line
 * is added here the first time it's needed.
 */
export async function saveChildcare(db: Db, c: { enabled: boolean; costPerDay: number; daysPerWeek: number; numChildren: number }): Promise<void> {
  await saveSettings(db, 'childcareSettings', c)
  if (!c.enabled) return
  const line = await anyDb(db).select().from(s.expense)
    .where(and(isNull(s.expense.deletedAt), eq(s.expense.cat, CHILDCARE_CAT), eq(s.expense.name, CHILDCARE_NAME))) as unknown[]
  if (line.length === 0) await insertRow(db, 'expense', { cat: CHILDCARE_CAT, name: CHILDCARE_NAME, freq: 'monthly', amt: 0 })
}
