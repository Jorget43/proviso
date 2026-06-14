// Developer watchdog (Phase 5) — internal tooling.
//
// The app hard-codes Australian tax/super assumptions that the government
// refreshes on a calendar (most on 1 July, HELP CPI on 1 June). This engine
// holds a registry of those assumptions, each stamped with the financial year
// it was last calibrated for, and flags the ones that are now due for review
// against the current FY. It does NOT fetch or auto-update — it prompts the
// developer to verify against the ATO/ABS and re-stamp the constant.
//
// Workflow when an item shows "review"/"overdue": confirm the current value
// with the cited authority, update the constant at `location`, then bump its
// `calibratedFyEnding` here.

export type WatchStatus = 'current' | 'review' | 'overdue'

export interface Assumption {
  id:                 string
  label:              string
  category:           'Income tax' | 'HELP' | 'Medicare' | 'Super'
  authority:          'ATO' | 'ABS' | 'Legislation'
  authorityUrl?:      string   // canonical URL to verify the current value
  location:           string   // file → symbol the developer edits
  currentValue:       string   // human-readable summary of what's in the code now
  calibratedFyEnding: number   // FY-ending year this value was last set/verified for
  reviewTrigger:      string   // when/where a refreshed value lands
  indexed:            boolean   // false = effectively static; never nags
  notes?:             string
}

export interface AssumptionStatus extends Assumption {
  status:   WatchStatus
  fyBehind: number
  message:  string
}

export interface WatchdogReport {
  now:             string
  currentFyEnding: number
  items:           AssumptionStatus[]
  counts:          Record<WatchStatus, number>
}

// Australian FY ends 30 June. July–Dec → next calendar year; Jan–Jun → this one.
export function financialYearEnding(now: Date): number {
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
}

// FY-ending year → label, e.g. 2025 → "2024-25".
export function fyLabel(ending: number): string {
  return `${ending - 1}-${String(ending).slice(2)}`
}

// The registry. Stamp `calibratedFyEnding` to the FY a value is correct for.
export const ASSUMPTIONS: Assumption[] = [
  {
    id: 'income-tax-brackets',
    label: 'Income tax brackets & rates (Stage 3)',
    category: 'Income tax',
    authority: 'ATO',
    authorityUrl: 'https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents',
    location: 'lib/tax.ts → TAX_THRESHOLDS_2425 / TAX_RATES_2425',
    currentValue: '0/16/30/37/45% at $0 / 18,200 / 45,000 / 135,000 / 190,000',
    calibratedFyEnding: 2025,
    reviewTrigger: 'Federal Budget (May); new scale effective 1 July',
    indexed: true,
  },
  {
    id: 'lito',
    label: 'Low Income Tax Offset (LITO)',
    category: 'Income tax',
    authority: 'ATO',
    authorityUrl: 'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/tax-offsets/low-income-tax-offset-and-low-and-middle-income-tax-offset',
    location: 'lib/tax.ts → calcLITO',
    currentValue: 'Max $700; phase-outs $37,500–45,000 (5%) then $45,000–66,667 (1.5%)',
    calibratedFyEnding: 2025,
    reviewTrigger: 'Annual; effective 1 July',
    indexed: true,
  },
  {
    id: 'help-thresholds',
    label: 'HELP/HECS repayment thresholds',
    category: 'HELP',
    authority: 'ATO',
    authorityUrl: 'https://www.ato.gov.au/individuals-and-families/study-and-training-loans/study-and-training-loan-repayment-thresholds-and-rates',
    location: 'lib/tax.ts → HELP_THRESHOLDS',
    currentValue: 'First threshold $54,435 @ 1.0% → top $167,206 @ 10.0%',
    calibratedFyEnding: 2025,
    reviewTrigger: 'Indexed annually; new schedule effective 1 July',
    indexed: true,
  },
  {
    id: 'medicare-low-threshold',
    label: 'Medicare levy low-income threshold',
    category: 'Medicare',
    authority: 'ATO',
    authorityUrl: 'https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction-for-low-income-earners',
    location: 'lib/tax.ts → MEDICARE_LOW_THRESH',
    currentValue: '$26,000 (single, simplified)',
    calibratedFyEnding: 2025,
    reviewTrigger: 'Indexed annually; announced around the Budget',
    indexed: true,
  },
  {
    id: 'help-cpi-rate',
    label: 'HELP CPI indexation rate',
    category: 'HELP',
    authority: 'ATO',
    authorityUrl: 'https://www.ato.gov.au/individuals-and-families/study-and-training-loans/when-your-loan-is-indexed',
    location: 'lib/help.ts / DebtsClient — default cpiRate (3.5%)',
    currentValue: 'Default fallback 3.5%',
    calibratedFyEnding: 2025,
    reviewTrigger: 'Announced late May; applies 1 June — confirm each year BEFORE 1 June',
    indexed: true,
    notes: 'Most time-sensitive item — the indexation date is 1 June, not 1 July.',
  },
  {
    id: 'super-guarantee-rate',
    label: 'Superannuation Guarantee rate',
    category: 'Super',
    authority: 'Legislation',
    authorityUrl: 'https://www.ato.gov.au/businesses-and-organisations/super-for-employers/working-out-if-you-have-to-pay-super/how-much-super-to-pay',
    location: 'Super inputs — sgRate default (12%)',
    currentValue: '12.0% (final under current legislation)',
    calibratedFyEnding: 2026,
    reviewTrigger: 'Reached 12% on 1 Jul 2025; no further increases legislated',
    indexed: false,
    notes: 'Static unless new SG legislation passes.',
  },
  {
    id: 'concessional-cap',
    label: 'Concessional contributions cap',
    category: 'Super',
    authority: 'ABS',
    authorityUrl: 'https://www.ato.gov.au/individuals-and-families/super/growing-and-keeping-track-of-your-super/caps-on-super-contributions/concessional-contributions-cap',
    location: 'lib/super.ts → CONCESSIONAL_CAP_BASE; lib/superHistory.ts → LEGISLATIVE_CONCESSIONAL_CAP',
    currentValue: '$30,000 (FY24-25 & FY25-26)',
    calibratedFyEnding: 2026,
    reviewTrigger: 'Indexed to AWOTE in $2,500 steps; AWOTE released ~Feb; change effective 1 July',
    indexed: true,
    notes: 'When AWOTE confirms a step, add the next FY to LEGISLATIVE_CONCESSIONAL_CAP.',
  },
  {
    id: 'div293-threshold',
    label: 'Division 293 income threshold',
    category: 'Super',
    authority: 'Legislation',
    authorityUrl: 'https://www.ato.gov.au/individuals-and-families/super/growing-and-keeping-track-of-your-super/caps-on-super-contributions/division-293-tax-information-for-individuals',
    location: 'lib/super.ts → DIV293_THRESHOLD',
    currentValue: '$250,000',
    calibratedFyEnding: 2026,
    reviewTrigger: 'Fixed since 2017 — not indexed',
    indexed: false,
  },
]

function evaluate(a: Assumption, currentFyEnding: number): AssumptionStatus {
  const fyBehind = currentFyEnding - a.calibratedFyEnding

  let status: WatchStatus
  if (!a.indexed || fyBehind <= 0)  status = 'current'
  else if (fyBehind === 1)          status = 'review'
  else                              status = 'overdue'

  let message: string
  if (status === 'current') {
    message = a.indexed
      ? `Calibrated for FY${fyLabel(a.calibratedFyEnding)}, the current year — no action.`
      : `Not indexed — verify only if the law changes.`
  } else {
    message =
      `Calibrated for FY${fyLabel(a.calibratedFyEnding)}, but the current year is ` +
      `FY${fyLabel(currentFyEnding)} (${fyBehind} FY behind). Confirm with the ${a.authority}, ` +
      `update ${a.location}, then re-stamp calibratedFyEnding to ${currentFyEnding}.`
  }

  return { ...a, status, fyBehind, message }
}

export function computeWatchdog(now: Date = new Date()): WatchdogReport {
  const currentFyEnding = financialYearEnding(now)
  const items = ASSUMPTIONS
    .map(a => evaluate(a, currentFyEnding))
    // Most urgent first.
    .sort((x, y) => y.fyBehind - x.fyBehind)

  const counts: Record<WatchStatus, number> = { current: 0, review: 0, overdue: 0 }
  for (const it of items) counts[it.status]++

  return { now: now.toISOString().slice(0, 10), currentFyEnding, items, counts }
}
