// Salary packaging (plan item 6): part of a person's pay goes to costs
// before tax, so less of it is taxed. Two kinds so far:
//
//   - Not-for-profit caps: staff of public benevolent institutions and
//     health promotion charities, and of public / not-for-profit hospitals
//     and ambulance services, can have expenses paid from pre-tax pay up to
//     a cap, plus salary-packaged meal entertainment up to its own cap.
//   - A novated lease on an electric car: lease and running costs come out
//     of pre-tax pay, and the car is exempt from fringe benefits tax.
//
// The packaged amount pays costs already in the budget (the bills paid
// through the package, or the car's lease and running costs), so take-home
// pay is: tax on the rest of the pay, plus the packaged amount back. The
// gain is the tax saved on the packaged amount.
//
// Both are still reportable fringe benefits: once their taxable value is
// over $2,000 a year, it is grossed up and counts for HELP repayments (and
// the Medicare levy surcharge and family tests, not modelled here).
//
// Figures for the FBT year ending 31 March 2027 (ATO "Fringe benefits tax
// – rates and thresholds", updated 20 May 2026; "Electric cars exemption",
// updated 1 April 2026; "Luxury car tax rate and thresholds" 2026–27).
// Re-check every April with the other July figures.

import { calcAfterTax, calcHELPRepayment } from './tax'

/** FBT year ending 31 March of this year (calendar year projected). */
export const PACKAGING_FBT_YEAR = 2027

/** Type 2 (lower) gross-up rate: used for reportable amounts and the not-for-profit caps. */
export const FBT_GROSS_UP_TYPE2 = 1.8868

/** Grossed-up caps on tax-free packaging, a year. */
export const PACKAGING_CAPS_GROSSED_UP = {
  pbi:               30_000,   // public benevolent institutions and health promotion charities
  hospital:          17_000,   // public and not-for-profit hospitals, public ambulance services
  mealEntertainment:  5_000,   // salary-packaged meal entertainment, on top of either
} as const

/** Reportable once benefits' total taxable value is over this. */
export const REPORTABLE_THRESHOLD = 2_000

/** Car fringe benefits: statutory formula rate on the car's base value. */
export const CAR_STATUTORY_RATE = 0.20

/** Luxury car tax threshold for fuel-efficient cars, 2026–27: an exempt electric car must cost less. */
export const EV_PRICE_LIMIT = 91_661

/**
 * Announced in the 2026–27 Budget (not yet law): from 1 April 2027, only
 * electric cars costing $75,000 or less stay fully exempt. Existing leases
 * keep the exemption.
 */
export const EV_ANNOUNCED_FULL_EXEMPT_PRICE = 75_000
export const EV_ANNOUNCED_FROM_YEAR = 2027

export type PackageKind = 'pbi' | 'hospital' | 'mealEntertainment' | 'evLease'
export const PACKAGE_KINDS: readonly PackageKind[] = ['pbi', 'hospital', 'mealEntertainment', 'evLease']

export const PACKAGE_LABELS: Record<PackageKind, string> = {
  pbi:               'Charity or health promotion charity',
  hospital:          'Public or not-for-profit hospital, ambulance',
  mealEntertainment: 'Meal entertainment (not-for-profit employers)',
  evLease:           'Novated lease on an electric car',
}

export interface PackagedItemLike {
  person:    'p1' | 'p2' | string
  /** A PackageKind; unknown kinds (from newer versions) are ignored. */
  kind:      string
  /** Packaged a year, pre-tax: bills paid, or the car's lease and running costs. */
  amount:    number
  /** The car's price (base value), for a novated lease. */
  carPrice:  number | null
  startYear: number
  /** The last year it runs; null: until the person stops work. */
  endYear:   number | null
}

const isKind = (k: string): k is PackageKind => (PACKAGE_KINDS as readonly string[]).includes(k)

/** Tax-free amount a year (not grossed up) for a capped kind: e.g. $30,000 / 1.8868 = $15,900. */
export const capFor = (kind: 'pbi' | 'hospital' | 'mealEntertainment'): number =>
  PACKAGING_CAPS_GROSSED_UP[kind] / FBT_GROSS_UP_TYPE2

export type EvStatus = 'exempt' | 'overPriceLimit' | 'announcedChange'

/** Whether an electric car qualifies: under the price limit, and (announced) under $75,000 if leased from April 2027. */
export function evStatus(carPrice: number | null, startYear: number): EvStatus {
  const price = carPrice ?? 0
  if (price >= EV_PRICE_LIMIT) return 'overPriceLimit'
  // A lease starting in 2027 is taken to start after 1 April (most of the year).
  if (startYear >= EV_ANNOUNCED_FROM_YEAR && price > EV_ANNOUNCED_FULL_EXEMPT_PRICE) return 'announcedChange'
  return 'exempt'
}

export interface PackageYear {
  /** Paid from pre-tax pay this year. */
  pretax:     number
  /** Reportable fringe benefits amount (grossed up), counted for HELP. 0 at or under the threshold. */
  reportable: number
}

export const NO_PACKAGE: PackageYear = { pretax: 0, reportable: 0 }

const active = (i: PackagedItemLike, year: number) => i.startYear <= year && (i.endYear === null || year <= i.endYear)

/**
 * One person's packaging in a year: what's paid pre-tax and the reportable
 * amount. Not-for-profit amounts are capped (one employer: the larger cap of
 * the kinds held); meal entertainment has its own cap. An electric car that
 * doesn't qualify isn't counted.
 */
export function packageYear(items: PackagedItemLike[], person: 'p1' | 'p2', year: number): PackageYear {
  const mine = items.filter(i => i.person === person && isKind(i.kind) && active(i, year) && i.amount > 0)
  const nfpItems = mine.filter(i => i.kind === 'pbi' || i.kind === 'hospital')
  const nfpCap = Math.max(0, ...nfpItems.map(i => capFor(i.kind as 'pbi' | 'hospital')))
  const nfp = Math.min(nfpCap, nfpItems.reduce((t, i) => t + i.amount, 0))
  const meal = Math.min(capFor('mealEntertainment'), mine.filter(i => i.kind === 'mealEntertainment').reduce((t, i) => t + i.amount, 0))
  const cars = mine.filter(i => i.kind === 'evLease' && evStatus(i.carPrice, i.startYear) === 'exempt')
  const car = cars.reduce((t, i) => t + i.amount, 0)
  // Car benefit's notional taxable value: 20% of the car's price (statutory formula).
  const carValue = cars.reduce((t, i) => t + CAR_STATUTORY_RATE * (i.carPrice ?? 0), 0)
  const taxableValue = nfp + meal + carValue
  return {
    pretax: nfp + meal + car,
    reportable: taxableValue > REPORTABLE_THRESHOLD ? taxableValue * FBT_GROSS_UP_TYPE2 : 0,
  }
}

/**
 * Take-home pay with packaging: tax on the pay left after super salary
 * sacrifice and packaging, the packaged amount back (it pays budgeted costs),
 * less HELP on repayment income (pay including the sacrifice, plus the
 * reportable amount).
 */
export function netPay(gross: number, sacrifice: number, hasHELP: boolean, pk: PackageYear = NO_PACKAGE): number {
  const taxable = Math.max(0, gross - sacrifice)
  const pretax = Math.min(pk.pretax, taxable)
  const help = hasHELP ? calcHELPRepayment(gross + pk.reportable) : 0
  return calcAfterTax(taxable - pretax) + pretax - help
}

/** How much more take-home pay a year packaging gives. */
export const packagingSaving = (gross: number, hasHELP: boolean, pk: PackageYear): number =>
  netPay(gross, 0, hasHELP, pk) - netPay(gross, 0, hasHELP)

/** This year's packaging for each person who works (for today's budget). */
export function packagingNow(items: PackagedItemLike[], year: number, days: { p1: number; p2: number }): { p1: PackageYear; p2: PackageYear } {
  return {
    p1: days.p1 > 0 ? packageYear(items, 'p1', year) : NO_PACKAGE,
    p2: days.p2 > 0 ? packageYear(items, 'p2', year) : NO_PACKAGE,
  }
}
