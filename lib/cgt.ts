// Capital Gains Tax estimator (Phase 6)
//
// Individuals/trusts get a 50% CGT discount on assets held for at least 12
// months. Eligibility is per-parcel (driven by purchase date), not per-asset.
// As of Jun 2026 the 50% discount still applies (the 2024 Budget change was
// not legislated). This module estimates CGT on a hypothetical sale so it can
// feed the Projections tab as a one-off in the planned sale year.

export const CGT_DISCOUNT_RATE = 0.5

export interface CgtInput {
  quantity:      number
  purchasePrice: number // per unit
  currentPrice:  number // per unit
  purchaseDate:  string // ISO date
  marginalRate:  number // owner's marginal rate incl. Medicare (fraction)
  asOf?:         Date   // hypothetical sale date — defaults to today
}

export interface CgtResult {
  costBase:         number
  marketValue:      number
  capitalGain:      number  // can be negative (capital loss)
  isLoss:           boolean
  heldMonths:       number
  discountEligible: boolean // held ≥ 12 months and a gain
  discountableGain: number  // gain after any 50% discount
  estimatedCgt:     number  // discountableGain × marginalRate (0 on a loss)
  netProceeds:      number  // marketValue − estimatedCgt
}

// True once the sale date is at least 12 months after purchase.
export function heldAtLeast12Months(purchaseDate: string, asOf: Date): boolean {
  const buy = new Date(purchaseDate)
  if (isNaN(buy.getTime())) return false
  const oneYearOn = new Date(buy)
  oneYearOn.setFullYear(oneYearOn.getFullYear() + 1)
  return asOf >= oneYearOn
}

function monthsBetween(from: Date, to: Date): number {
  if (isNaN(from.getTime())) return 0
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  return Math.max(0, to.getDate() >= from.getDate() ? months : months - 1)
}

export function computeCgt(input: CgtInput): CgtResult {
  const asOf = input.asOf ?? new Date()
  const costBase    = input.quantity * input.purchasePrice
  const marketValue = input.quantity * input.currentPrice
  const capitalGain = marketValue - costBase
  const isLoss      = capitalGain < 0

  const heldMonths = monthsBetween(new Date(input.purchaseDate), asOf)
  const discountEligible = !isLoss && capitalGain > 0 && heldAtLeast12Months(input.purchaseDate, asOf)

  const discountableGain = isLoss
    ? capitalGain
    : discountEligible ? capitalGain * (1 - CGT_DISCOUNT_RATE) : capitalGain

  const estimatedCgt = isLoss ? 0 : Math.max(0, discountableGain * input.marginalRate)
  const netProceeds  = marketValue - estimatedCgt

  return {
    costBase,
    marketValue,
    capitalGain,
    isLoss,
    heldMonths,
    discountEligible,
    discountableGain,
    estimatedCgt,
    netProceeds,
  }
}
