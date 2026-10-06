// Changes made on the Wealth screen: what you own and owe, the home loan,
// super. All through mutate.ts, with the same linked figures the NAS keeps:
//   - the loan's offset balance is the sum of accounts marked as cash
//     (isOffset), whenever any are marked;
//   - the budget's "Mortgage" line follows the loan repayment.

import { and, eq, isNull } from 'drizzle-orm'
import * as s from '@proviso/core/schema'
import type { Db } from './db'
import { insertRow, updateRow, deleteRow, saveSettings } from './mutate'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (db: Db) => db as any

export interface AssetDraft { name: string; amt: number; isOffset: boolean }
export interface DebtDraft  { name: string; amt: number }

export async function saveAsset(db: Db, id: string | null, d: AssetDraft): Promise<string> {
  const row = { name: d.name.trim(), amt: d.amt, isOffset: d.isOffset }
  if (id) await updateRow(db, 'asset', id, row)
  else id = await insertRow(db, 'asset', row)
  await syncOffset(db)
  return id
}

export async function removeAsset(db: Db, id: string): Promise<void> {
  await deleteRow(db, 'asset', id)
  await syncOffset(db)
}

export async function saveDebt(db: Db, id: string | null, d: DebtDraft): Promise<string> {
  const row = { name: d.name.trim(), amt: d.amt }
  if (id) { await updateRow(db, 'debt', id, row); return id }
  return insertRow(db, 'debt', row)
}

export const removeDebt = (db: Db, id: string) => deleteRow(db, 'debt', id)

/** While any account is marked as cash, their total is the loan's offset balance. */
export async function syncOffset(db: Db): Promise<void> {
  const live = await anyDb(db).select().from(s.asset).where(isNull(s.asset.deletedAt)) as s.HouseholdRow<'asset'>[]
  const offset = live.filter(a => a.isOffset)
  if (offset.length === 0) return
  const loan = await anyDb(db).select().from(s.mortgageSettings).where(isNull(s.mortgageSettings.deletedAt)) as unknown[]
  if (loan.length === 0) return
  await saveSettings(db, 'mortgageSettings', { offsetBal: offset.reduce((t, a) => t + a.amt, 0) })
}

export interface LoanDraft { balance: number; rate: number; payment: number; endDate: string }

/** Saves the home loan, and keeps the budget's Mortgage line at the repayment. */
export async function saveLoan(db: Db, d: LoanDraft): Promise<void> {
  await saveSettings(db, 'mortgageSettings', d)
  await syncOffset(db)
  const line = await anyDb(db).select().from(s.expense)
    .where(and(isNull(s.expense.deletedAt), eq(s.expense.cat, 'Home'), eq(s.expense.name, 'Mortgage'))) as s.HouseholdRow<'expense'>[]
  if (line.length) for (const l of line) await updateRow(db, 'expense', l.id, { amt: d.payment, freq: 'monthly' })
  else if (d.payment > 0) await insertRow(db, 'expense', { cat: 'Home', name: 'Mortgage', freq: 'monthly', amt: d.payment })
}

export interface SuperDraft { person1Balance: number; person1RetirementAge: number; person2Balance: number; person2RetirementAge: number }

export const saveSuper = (db: Db, d: Partial<SuperDraft>) => saveSettings(db, 'superSettings', d)
