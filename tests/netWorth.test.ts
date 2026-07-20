import { describe, it, expect } from 'vitest'
import { computeCurrentNetWorth } from '@/lib/netWorth'
import type { Debt, Asset, MortgageSettings } from '@prisma/client'

const mortgage: MortgageSettings = {
  id: 1, balance: 500000, rate: 5.99, payment: 3000, offsetBal: 0, endDate: '2053-01-16',
}

describe('computeCurrentNetWorth', () => {
  it('combines house equity, offset cash and crypto against the mortgage', () => {
    const debts: Debt[] = [{ id: 1, name: 'Mortgage', amt: 500000 }]
    const assets: Asset[] = [
      { id: 1, name: 'House equity', amt: 300000, isOffset: false },
      { id: 2, name: 'Cash', amt: 50000, isOffset: true },
      { id: 3, name: 'Crypto', amt: 20000, isOffset: false },
    ]
    const r = computeCurrentNetWorth(debts, assets, mortgage)
    expect(r.mortDebt).toBe(500000)
    expect(r.propValue).toBe(800000)   // mortDebt + equity
    expect(r.cryptoValue).toBe(20000)
    expect(r.cashOnHand).toBe(50000)   // isOffset asset
    expect(r.netWorth).toBe(370000)    // 800000 + 50000 + 20000 - 500000
  })

  it('sums multiple offset accounts, ignoring the legacy cash fallback', () => {
    const assets: Asset[] = [
      { id: 1, name: 'Offset A', amt: 30000, isOffset: true },
      { id: 2, name: 'Offset B', amt: 20000, isOffset: true },
      { id: 3, name: 'Cash savings', amt: 99999, isOffset: false },
    ]
    const r = computeCurrentNetWorth([], assets, mortgage)
    expect(r.cashOnHand).toBe(50000)
  })

  it('falls back to the mortgage balance when no mortgage debt row exists', () => {
    const r = computeCurrentNetWorth([], [], mortgage)
    expect(r.mortDebt).toBe(500000)
    expect(r.netWorth).toBe(0) // no equity/cash/crypto → propValue(500000) - mortDebt(500000)
  })
})
