// Income from savings and investments (plan item 5a): interest on cash and
// dividends on investments outside super, taxed at each person's marginal
// rate, with franking credits.
//
//   - Interest: cash above the home-loan balance earns `cashRate` (cash up to
//     the balance sits in the offset, where it saves loan interest instead).
//   - Dividends: `dividendYield` of the investments is paid out each year. It
//     is part of the total investment return, not on top of it, and it's
//     reinvested (as with a dividend reinvestment plan), so the balance grows
//     as before. Only the tax is paid from cash.
//   - Franking: `frankedPct` of dividends carry credits for company tax paid
//     at 30%. The dividend is grossed up by the credit for taxable income, and
//     the credit comes off the tax; credits beyond the tax are refunded.
//   - Each person's share is taxed on top of their other taxable income, so a
//     retiree with no pay pays little or nothing on it.
//
// Not modelled: HELP and the Medicare levy surcharge counting investment
// income, the Child Care Subsidy income test, capital gains on sales, and
// unfranked foreign income tax offsets.

import { calcAfterTax } from './tax'

/** Company tax rate behind franking credits (large companies; most listed shares and ETFs). */
export const FRANKING_COMPANY_RATE = 0.30

/** Defaults: a mix of Australian and overseas shares, a high-interest savings account. */
export const DEFAULT_DIVIDEND_YIELD = 3
export const DEFAULT_FRANKED_PCT    = 50
export const DEFAULT_CASH_RATE      = 4
export const DEFAULT_PERSON1_SHARE  = 50

export interface InvestIncomeSettings {
  /** % of investments paid out as dividends each year (part of the total return). */
  dividendYield: number
  /** % of dividends that are franked. */
  frankedPct:    number
  /** % a year earned on cash above the home-loan balance. */
  cashRate:      number
  /** % of investment income in Person 1's name (the rest is Person 2's; all Person 1's without a partner). */
  person1Share:  number
}

/** The franking credit attached to a dividend. */
export const frankingCredit = (dividend: number, frankedPct: number): number =>
  dividend * (Math.min(100, Math.max(0, frankedPct)) / 100) * FRANKING_COMPANY_RATE / (1 - FRANKING_COMPANY_RATE)

/** Income tax and the Medicare levy on a taxable income. */
export const taxOn = (taxable: number): number => (taxable > 0 ? taxable - calcAfterTax(taxable) : 0)

/**
 * The extra tax `extra` taxable income costs on top of `base`, less franking
 * credits. Negative means a refund (credits beyond the tax).
 */
export function taxOnTop(base: number, extra: number, credits: number): number {
  const b = Math.max(0, base)
  return taxOn(b + Math.max(0, extra)) - taxOn(b) - credits
}

/** The gross pay that leaves `net` after tax (for households that record take-home pay). */
export function grossFromNet(net: number): number {
  if (!(net > 0)) return 0
  let lo = net, hi = net * 2 + 50_000
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (calcAfterTax(mid) < net) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

export interface InvestIncomeYear {
  interest:  number
  dividends: number
  credits:   number
  /** Tax on the year's investment income across both people, after credits (negative: a refund). */
  tax:       number
  /** What reaches cash: interest less the tax (dividends are reinvested). */
  cash:      number
}

/**
 * One year's investment income and its tax. `cash`, `loan` and `invest` are
 * start-of-year balances; `taxable` is each person's other taxable income.
 */
export function investIncomeYear(s: InvestIncomeSettings, b: { cash: number; loan: number; invest: number },
  taxable: [number, number], partner: boolean): InvestIncomeYear {
  const interest  = Math.max(0, b.cash - Math.max(0, b.loan)) * Math.max(0, s.cashRate) / 100
  const dividends = Math.max(0, b.invest) * Math.max(0, s.dividendYield) / 100
  const credits   = frankingCredit(dividends, s.frankedPct)
  const share1    = partner ? Math.min(100, Math.max(0, s.person1Share)) / 100 : 1
  const assessable = interest + dividends + credits   // dividends grossed up by the credits
  const tax = taxOnTop(taxable[0], assessable * share1, credits * share1)
    + (partner ? taxOnTop(taxable[1], assessable * (1 - share1), credits * (1 - share1)) : 0)
  return { interest, dividends, credits, tax, cash: interest - tax }
}
