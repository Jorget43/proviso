// Setting up a new household from the questionnaire (app/setup.tsx): the
// answers become rows via @proviso/core/starter, written here in one go.
//
// Like an import, this is local set-up before sync exists: it replaces
// whatever this device had (a household started but never set up). Rows are
// written through mutate.ts, so the same path carries them into sync later.

import { sql } from 'drizzle-orm'
import { HOUSEHOLD_TABLES } from '@proviso/core/schema'
import type { StarterHousehold } from '@proviso/core/starter'
import type { Db } from './db'
import { insertRow, updateRow, saveSettings } from './mutate'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (db: Db) => db as any

export async function startHousehold(db: Db, h: StarterHousehold): Promise<void> {
  await db.run(sql`BEGIN`)
  try {
    for (const t of Object.values(HOUSEHOLD_TABLES)) await anyDb(db).delete(t)

    await saveSettings(db, 'householdSettings', h.household)
    await saveSettings(db, 'incomeSettings', h.income)
    await saveSettings(db, 'superSettings', h.super)
    await saveSettings(db, 'childcareSettings', h.childcare)
    await saveSettings(db, 'rentSettings', h.rent)
    await saveSettings(db, 'projectionSettings', h.projection)
    if (h.mortgage) await saveSettings(db, 'mortgageSettings', h.mortgage)

    for (const w of h.workPhases) await insertRow(db, 'workPhase', w)
    for (const e of h.expenses)   await insertRow(db, 'expense', e)
    for (const a of h.assets)     await insertRow(db, 'asset', a)
    for (const d of h.debts)      await insertRow(db, 'debt', d)
    await db.run(sql`COMMIT`)
  } catch (err) {
    await db.run(sql`ROLLBACK`)
    throw err
  }
}

/**
 * Changes a person's pay and the days a week they work this year. In tax mode
 * pay is the full-time salary before tax; otherwise it's take-home per month
 * (households that track net pay, e.g. brought across from the NAS).
 */
export async function savePay(
  db: Db, person: 'p1' | 'p2',
  pay: { amount: number; days: number; hasHelp: boolean; taxMode: boolean },
  workPhases: { id: string; person: string; year: number }[], year: number,
): Promise<void> {
  const n = person === 'p1' ? 1 : 2
  await saveSettings(db, 'incomeSettings', pay.taxMode
    ? { [`person${n}FTE`]: pay.amount, [`person${n}HasHELP`]: pay.hasHelp }
    : { [`person${n}MonthlyNet`]: pay.amount })
  const phase = workPhases.find(w => w.person === person && w.year === year)
  if (phase) await updateRow(db, 'workPhase', phase.id, { days: pay.days })
  else await insertRow(db, 'workPhase', { person, year, days: pay.days })
}
