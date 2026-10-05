import type { Debt, Asset, MortgageSettings } from '@prisma/client'

// ── One definition of net worth, used everywhere ─────────────────────────────
// Net worth = everything listed as owned minus everything owed (Wealth → Own &
// owe), with the home counted once, as equity: a "house"/"equity" asset is the
// home's value minus its loan, so a "mortgage" debt row isn't subtracted again.
// Super is left out (shown separately on the Super tab). Home, Own & owe,
// Projections ("today" and the engine's starting point) and the monthly
// snapshots all use this, so they always agree.

type NamedAmt = { name: string; amt: number }

/** Snapshots before this date used a narrower definition (no shares, no other debts). */
export const NET_WORTH_DEFINED_FROM = new Date('2026-10-06T00:00:00Z')

export const isMortgageDebt = (d: { name: string }) => d.name.toLowerCase().includes('mortgage')
export const isHomeEquity   = (a: { name: string }) => /house|equity/i.test(a.name)
export const isCrypto       = (a: { name: string }) => a.name.toLowerCase().includes('crypto')

// Cash on hand = accounts flagged isOffset on Debts & Assets. Falls back to the
// legacy 'cash'-named asset when nothing is flagged yet. Shared by Budget,
// Cashflow and Projections so every tab shows the same figure.
export function computeCashOnHand(assets: Pick<Asset, 'name' | 'amt' | 'isOffset'>[]): number {
  const offsetAssets = assets.filter(a => a.isOffset)
  return offsetAssets.length > 0
    ? offsetAssets.reduce((s, a) => s + a.amt, 0)
    : assets.find(a => a.name.toLowerCase().includes('cash'))?.amt ?? 0
}

export interface NetPosition {
  totalAssets:      number
  debtsOwed:        number   // all debts except mortgage rows (netted in home equity)
  netWorth:         number
  mortgageExcluded: number   // mortgage debt rows left out, for the explanation
}

/** Net worth from the Own & owe lists alone — used live while editing them. */
export function netPositionOf(debts: NamedAmt[], assets: NamedAmt[]): NetPosition {
  const totalAssets      = assets.reduce((s, a) => s + a.amt, 0)
  const mortgageExcluded = debts.filter(isMortgageDebt).reduce((s, d) => s + d.amt, 0)
  const debtsOwed        = debts.reduce((s, d) => s + d.amt, 0) - mortgageExcluded
  return { totalAssets, debtsOwed, netWorth: totalAssets - debtsOwed, mortgageExcluded }
}

export interface NetWorthBaseline extends NetPosition {
  mortDebt:    number
  propValue:   number   // home value = loan + equity
  cryptoValue: number
  cashOnHand:  number
  otherAssets: number   // shares, other savings etc. — the projection's starting investments
}

// The breakdown the Projections engine starts from. Its parts add back up to
// netWorth: propValue − mortDebt (= equity) + cash + crypto + otherAssets −
// debtsOwed.
export function computeCurrentNetWorth(debts: Debt[], assets: Asset[], mortgage: Pick<MortgageSettings, 'balance'> | null): NetWorthBaseline {
  const mortDebt    = debts.find(isMortgageDebt)?.amt ?? mortgage?.balance ?? 0
  const equity      = assets.find(isHomeEquity)?.amt ?? 0
  const cryptoValue = assets.find(isCrypto)?.amt ?? 0
  const cashOnHand  = computeCashOnHand(assets)
  const position    = netPositionOf(debts, assets)
  const otherAssets = Math.max(0, position.totalAssets - equity - cryptoValue - cashOnHand)

  return { ...position, mortDebt, propValue: mortDebt + equity, cryptoValue, cashOnHand, otherAssets }
}
