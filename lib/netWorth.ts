import type { Debt, Asset, MortgageSettings } from '@prisma/client'

export interface NetWorthBaseline {
  mortDebt:    number
  propValue:   number
  cryptoValue: number
  cashOnHand:  number
  netWorth:    number
}

// Cash on hand = accounts flagged isOffset on Debts & Assets. Falls back to the
// legacy 'cash'-named asset when nothing is flagged yet. Shared by Budget,
// Cashflow and Projections so every tab shows the same figure.
export function computeCashOnHand(assets: Pick<Asset, 'name' | 'amt' | 'isOffset'>[]): number {
  const offsetAssets = assets.filter(a => a.isOffset)
  return offsetAssets.length > 0
    ? offsetAssets.reduce((s, a) => s + a.amt, 0)
    : assets.find(a => a.name.toLowerCase().includes('cash'))?.amt ?? 0
}

// Baseline net worth used to seed the Projections engine — matches its scope
// exactly (house equity, cash/offset, crypto, mortgage) so a later "actual"
// snapshot lines up with where the projected line starts, rather than
// including debts/assets (e.g. HELP debt, a car) the projection doesn't model.
export function computeCurrentNetWorth(debts: Debt[], assets: Asset[], mortgage: MortgageSettings): NetWorthBaseline {
  const mortDebt    = debts.find(d => d.name.toLowerCase().includes('mortgage'))?.amt ?? mortgage.balance
  const equity      = assets.find(a => a.name.toLowerCase().includes('house') || a.name.toLowerCase().includes('equity'))?.amt ?? 0
  const propValue   = mortDebt + equity
  const cryptoValue = assets.find(a => a.name.toLowerCase().includes('crypto'))?.amt ?? 0

  const cashOnHand  = computeCashOnHand(assets)

  const netWorth = propValue + cashOnHand + cryptoValue - mortDebt

  return { mortDebt, propValue, cryptoValue, cashOnHand, netWorth }
}
