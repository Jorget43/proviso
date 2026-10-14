// Household settings changed from Settings: names, birth years and partner,
// children, rent, childcare. All through mutate.ts.

import { and, eq, isNull } from 'drizzle-orm'
import * as s from '@proviso/core/schema'
import { validateMemberNames } from '@proviso/core/members'
import { CHILDCARE_CAT, CHILDCARE_NAME } from '@proviso/core/budgetSummary'
import { birthYearPatch, missingBirthYears } from '@proviso/core/people'
import type { Db } from './db'
import { deleteRow, insertRow, saveSettings, updateRow } from './mutate'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (db: Db) => db as any

/** Earliest and latest birth years accepted for an adult. */
export const adultBirthYears = (year: number) => ({ min: year - 100, max: year - 16 })

/**
 * Saves the names, birth years (and whether there's a partner). Returns an
 * error in plain words, or null. A birth year left null isn't changed.
 */
export async function savePeople(
  db: Db,
  p: { person1Name: string; person2Name: string; partnerEnabled: boolean; person1BirthYear?: number | null; person2BirthYear?: number | null },
  year: number = new Date().getFullYear(),
): Promise<string | null> {
  const person1Name = p.person1Name.trim(), person2Name = p.person2Name.trim() || 'Partner'
  const invalid = validateMemberNames(person1Name, person2Name, p.partnerEnabled)
  if (invalid) return invalid
  const range = adultBirthYears(year)
  const born = ([1, 2] as const).filter(n => n === 1 || p.partnerEnabled)
    .map(n => [n, p[`person${n}BirthYear`]] as const).filter(([, y]) => y != null) as [1 | 2, number][]
  for (const [, y] of born) {
    if (!Number.isInteger(y) || y < range.min || y > range.max) return `Birth years need to be between ${range.min} and ${range.max}.`
  }
  if (born.length) await saveSettings(db, 'incomeSettings', Object.assign({}, ...born.map(([n, y]) => birthYearPatch(n, y, year))))
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

/**
 * Households from before birth years only have ages, which go stale each
 * January. The first time a device opens one, it records the birth years the
 * ages mean (synced like any edit; two devices doing this write the same
 * values). Returns whether anything was written.
 */
export async function fillBirthYears(db: Db, year: number): Promise<boolean> {
  const [settings] = await anyDb(db).select().from(s.householdSettings).where(isNull(s.householdSettings.deletedAt)) as unknown[]
  if (!settings) return false   // not set up yet
  const [income] = await anyDb(db).select().from(s.incomeSettings).where(isNull(s.incomeSettings.deletedAt)) as s.HouseholdRow<'incomeSettings'>[]
  if (!income) return false
  const patch = missingBirthYears(income, year)
  if (!Object.keys(patch).length) return false
  await saveSettings(db, 'incomeSettings', patch)
  return true
}

export interface ChildForm { name: string; birthYear: number; birthMonth: number | null }

/** Checks a child's details; returns a problem in plain words, or null. */
export function checkChild(c: ChildForm, year: number): string | null {
  // Up to 10 years ahead, for a child being planned (their costs start then).
  if (!Number.isInteger(c.birthYear) || c.birthYear < year - 40 || c.birthYear > year + 10) return `Enter the year they were born, or are due or planned (${year - 40} to ${year + 10}).`
  if (c.birthMonth !== null && !(Number.isInteger(c.birthMonth) && c.birthMonth >= 1 && c.birthMonth <= 12)) return 'Choose a month, or leave it blank.'
  if (c.name.trim().length > 40) return 'Keep the name to 40 characters.'
  return null
}

/** Adds a child (id null) or changes one. Returns a problem in plain words, or null. */
export async function saveChild(db: Db, id: string | null, c: ChildForm, year: number = new Date().getFullYear()): Promise<string | null> {
  const problem = checkChild(c, year)
  if (problem) return problem
  const row = { name: c.name.trim() || null, birthYear: c.birthYear, birthMonth: c.birthMonth }
  if (id) await updateRow(db, 'child', id, row)
  else await insertRow(db, 'child', row)
  return null
}

export const removeChild = (db: Db, id: string) => deleteRow(db, 'child', id)
