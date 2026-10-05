import { describe, it, expect } from 'vitest'
import { computeCurrentNetWorth, netPositionOf } from '@/lib/netWorth'
import type { Debt, Asset, MortgageSettings } from '@prisma/client'

const mortgage: MortgageSettings = {
  id: 1, balance: 500000, rate: 6.25, payment: 3000, offsetBal: 0, endDate: '2055-06-01',
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

describe('one net worth definition (Home, Own & owe, Projections)', () => {
  it('counts shares and other debts — what Home shows is what Projections starts from', () => {
    const assets: Asset[] = [
      { id: 1, name: 'Cash / savings', amt: 25000, isOffset: true },
      { id: 2, name: 'Shares & ETFs',  amt: 40000, isOffset: false },
    ]
    const debts: Debt[] = [{ id: 1, name: 'Alex HELP debt', amt: 18000 }]
    const r = computeCurrentNetWorth(debts, assets, { balance: 620000 })
    expect(r.netWorth).toBe(47000)          // 25000 + 40000 - 18000
    expect(r.otherAssets).toBe(40000)       // the engine's starting investments
    expect(r.debtsOwed).toBe(18000)
    expect(r.propValue - r.mortDebt).toBe(0) // no equity recorded → home nets to zero
    // The parts the engine is given add back up to the same figure.
    expect(r.propValue - r.mortDebt + r.cashOnHand + r.cryptoValue + r.otherAssets - r.debtsOwed).toBe(r.netWorth)
  })

  it('counts the home once, as equity — a mortgage debt row is not subtracted again', () => {
    const debts = [{ name: 'Mortgage', amt: 500000 }, { name: 'Car loan', amt: 10000 }]
    const assets = [{ name: 'House equity', amt: 300000 }]
    const p = netPositionOf(debts, assets)
    expect(p.netWorth).toBe(290000)
    expect(p.mortgageExcluded).toBe(500000)
    expect(p.debtsOwed).toBe(10000)
  })

  it('works without a mortgage settings row', () => {
    expect(computeCurrentNetWorth([], [], null).netWorth).toBe(0)
  })
})
