// Reads the household's live rows (deletedAt IS NULL) for the screens.
// One read feeds every view; views (src/data/views.ts) are pure functions of
// what's returned here plus the shared calculations in @proviso/core.

import { isNull } from 'drizzle-orm'
import * as s from '@proviso/core/schema'
import { withDefaults } from '@proviso/core/rows'
import type { Db } from './db'

type R<T extends s.HouseholdTableName> = s.HouseholdRow<T>

export interface HouseholdData {
  /** False until the household has been set up (start fresh or import). */
  exists:         boolean
  settings:       R<'householdSettings'>
  members:        R<'member'>[]
  expenses:       R<'expense'>[]
  annualExpenses: R<'annualExpense'>[]
  debts:          R<'debt'>[]
  assets:         R<'asset'>[]
  workPhases:     R<'workPhase'>[]
  netWorthSnapshots: R<'netWorthSnapshot'>[]
  oneOffs:        R<'oneOff'>[]
  lifePhases:     R<'lifePhase'>[]
  schoolFeeLevels: R<'schoolFeeLevel'>[]
  income:         R<'incomeSettings'>
  childcare:      R<'childcareSettings'>
  mortgage:       R<'mortgageSettings'> | null
  projection:     R<'projectionSettings'>
  superSettings:  R<'superSettings'>
  rent:           R<'rentSettings'>
}

async function live<T extends s.HouseholdTableName>(db: Db, name: T): Promise<R<T>[]> {
  const t = s.HOUSEHOLD_TABLES[name]
  // The union of table types defeats Drizzle's generics here; rows are typed by the caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (db as any).select().from(t).where(isNull(t.deletedAt)) as R<T>[]
}

async function one<T extends s.HouseholdTableName>(db: Db, name: T): Promise<R<T> | undefined> {
  return (await live(db, name))[0]
}

export async function loadHousehold(db: Db): Promise<HouseholdData> {
  const [
    settings, members, expenses, annualExpenses, debts, assets, workPhases, netWorthSnapshots,
    income, childcare, mortgage, projection, superSettings, rent, oneOffs, lifePhases, schoolFeeLevels,
  ] = await Promise.all([
    one(db, 'householdSettings'), live(db, 'member'), live(db, 'expense'), live(db, 'annualExpense'),
    live(db, 'debt'), live(db, 'asset'), live(db, 'workPhase'), live(db, 'netWorthSnapshot'),
    one(db, 'incomeSettings'), one(db, 'childcareSettings'), one(db, 'mortgageSettings'),
    one(db, 'projectionSettings'), one(db, 'superSettings'), one(db, 'rentSettings'),
    live(db, 'oneOff'), live(db, 'lifePhase'), live(db, 'schoolFeeLevel'),
  ])
  const id = s.SETTINGS_ID
  return {
    exists: settings !== undefined,
    settings:      withDefaults(s.householdSettings, id.household, settings),
    members, expenses, annualExpenses, debts, assets, workPhases, netWorthSnapshots, oneOffs,
    lifePhases: lifePhases.sort((a, b) => a.sortOrder - b.sortOrder), schoolFeeLevels,
    income:        withDefaults(s.incomeSettings, id.income, income),
    childcare:     withDefaults(s.childcareSettings, id.childcare, childcare),
    mortgage:      mortgage ?? null,
    projection:    withDefaults(s.projectionSettings, id.projections, projection),
    superSettings: withDefaults(s.superSettings, id.super, superSettings),
    rent:          withDefaults(s.rentSettings, id.rent, rent),
  }
}
