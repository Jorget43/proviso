// Uncertain returns (plan item 8b): Monte Carlo runs and the glide path.
// Replaces the ±points band of ranges.ts (item 8a) on both clients.
//
// The plan is the projection with every year's return as expected: the
// household's own investment and super returns, moved by the glide path
// when it's on. Around it, MC_RUNS runs draw each year's return at random,
// with swings set by the share held in growth assets (shares, property).
// Good and bad years then fall in a random order, which is what the band
// of 8a couldn't show: a crash just before or after retiring hurts more.
//
// Assumptions (estimates, chosen for the plan's figures, not market data):
//   - Growth assets swing about 16% a year, defensive ones (bonds, cash)
//     about 4%, with a correlation of 0.1. A 90 / 70 / 50% growth mix then
//     swings about 14 / 11 / 8.5% a year.
//   - Growth assets earn about 3.5 points a year more than defensive ones
//     over the long run, so moving 10 points of the mix towards defensive
//     lowers the expected return by 0.35 points.
//   - The household's set return is the typical (median) year-on-year
//     growth, so the middle of the runs lands on the plan line rather than
//     below it. Yearly returns are lognormal around it.
//   - Investments outside super and super move together in each year (one
//     market); runs are seeded, so the same household always shows the
//     same figures.

import { runProjections, type ProjectionInputs, type ProjectionOutput, type ProjectionResult } from './projections'

export const MC_RUNS = 500
const SEED = 20261019

export const GROWTH_VOL     = 0.16
export const DEFENSIVE_VOL  = 0.04
export const MIX_CORRELATION = 0.1
/** Extra yearly return of growth over defensive assets, percentage points. */
export const GROWTH_PREMIUM = 3.5

export const DEFAULT_GROWTH_PCT = 70

/** The mixes offered on screen (growth share, %). */
export const MIX_CHOICES = [
  { growthPct: 30, label: 'Conservative' },
  { growthPct: 50, label: 'Balanced' },
  { growthPct: 70, label: 'Growth' },
  { growthPct: 90, label: 'High growth' },
] as const
export const DEFAULT_GLIDE_TARGET_PCT = 50

export interface MixSettings {
  /** % of investments (and super) in growth assets today. */
  growthPct:     number
  /** Move towards `glideTargetPct` by the time everyone has retired. */
  glidePath:     boolean
  glideTargetPct: number
}

/** The mix from saved projection settings (defaults for rows from before v10). */
export function mixFrom(s: { growthPct?: number; glidePath?: boolean; glideTargetPct?: number }): MixSettings {
  return { growthPct: s.growthPct ?? DEFAULT_GROWTH_PCT, glidePath: s.glidePath ?? false, glideTargetPct: s.glideTargetPct ?? DEFAULT_GLIDE_TARGET_PCT }
}

/** Whether the range is shown: the v10 switch, or before it, a spread above 0. */
export function rangeOn(s: { showRange?: boolean | null; returnSpread?: number }): boolean {
  return s.showRange ?? (s.returnSpread ?? 2) > 0
}

/** How much a mix swings in a year (standard deviation of its return, decimal). */
export function mixVolatility(growthPct: number): number {
  const g = Math.min(100, Math.max(0, growthPct)) / 100, d = 1 - g
  return Math.sqrt((g * GROWTH_VOL) ** 2 + (d * DEFENSIVE_VOL) ** 2 + 2 * g * d * MIX_CORRELATION * GROWTH_VOL * DEFENSIVE_VOL)
}

/** The growth share in each projected year (index 0 = next year): flat, or gliding to the target by retirement. */
export function mixPath(mix: MixSettings, years: number, yearsToRetire: number): number[] {
  if (!mix.glidePath) return Array(years).fill(mix.growthPct)
  const span = Math.max(1, yearsToRetire)
  return Array.from({ length: years }, (_, i) => mix.growthPct + (mix.glideTargetPct - mix.growthPct) * Math.min(1, (i + 1) / span))
}

/** Years until the last adult retires (the whole horizon without a life course). */
export function yearsToLastRetirement(inputs: ProjectionInputs): number {
  const lc = inputs.lifeCourse
  if (!lc) return inputs.projYears
  const p1 = lc.person1RetirementAge - lc.person1Age
  const p2 = lc.partnerEnabled ? lc.person2RetirementAge - lc.person2Age : 0
  return Math.max(p1, p2)
}

/** The plan's inputs: expected returns year by year, moved by the glide path when it's on. */
export function planInputs(inputs: ProjectionInputs, mix: MixSettings): ProjectionInputs {
  if (!mix.glidePath) return inputs
  const path = mixPath(mix, inputs.projYears, yearsToLastRetirement(inputs))
  const shift = (g: number) => (g - mix.growthPct) / 100 * GROWTH_PREMIUM   // percentage points
  return {
    ...inputs,
    investReturnByYear: path.map(g => inputs.investReturn + shift(g)),
    superReturnByYear: inputs.lifeCourse && path.map(g => inputs.lifeCourse!.superReturn + shift(g) / 100),
  }
}

// ── Randomness: seeded, so results don't change from one look to the next ──

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal draws (Box–Muller). */
export function normals(seed: number, count: number): number[] {
  const rand = mulberry32(seed), out: number[] = []
  while (out.length < count) {
    const u = Math.max(rand(), 1e-12), v = rand()
    const r = Math.sqrt(-2 * Math.log(u))
    out.push(r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v))
  }
  return out.slice(0, count)
}

/** One year's return (decimal) with median `median` (decimal) and swing `vol`, for a standard normal draw z. */
export function drawReturn(median: number, vol: number, z: number): number {
  const s = Math.sqrt(Math.log(1 + (vol / (1 + median)) ** 2))
  return Math.exp(Math.log(1 + median) + s * z) - 1
}

// ── The outlook ────────────────────────────────────────────────────────────

export interface Band { low: number[]; high: number[] }

export interface Outlook {
  /** The plan: expected returns (glide path applied when on). */
  plan:  ProjectionOutput
  /** False when the range is switched off: only the plan was run. */
  on:    boolean
  runs:  number
  /** 10th to 90th percentile each year: net worth (super not counted), with super, and super alone. */
  netWorth:          Band
  netWorthWithSuper: Band
  super:             Band
  endNetWorth: { low: number; mid: number; high: number }
  /** Share of runs (0–1) where money lasts the whole projection; null without a life course. */
  chanceLasts: number | null
  /** Person 1's age when money runs short in the worst tenth of runs; null if it lasts there too. */
  shortAgeLow: number | null
  /** The plan's own shortfall age, for comparison. */
  shortAgeMid: number | null
}

/** The run that counts (with school fees when they're on). */
export const mainOf = (o: ProjectionOutput): ProjectionResult => o.withFees ?? o.base

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]

function band(runs: number[][], years: number): Band {
  const low: number[] = [], high: number[] = []
  for (let y = 0; y < years; y++) {
    const col = runs.map(r => r[y]).sort((a, b) => a - b)
    low.push(pct(col, 0.1)); high.push(pct(col, 0.9))
  }
  return { low, high }
}

/**
 * The plan and, when `on`, MC_RUNS runs with random returns. `person1Age`
 * is this year's age (for "runs short at age N"); `currentYear` the year
 * the projection starts from.
 */
export function runOutlook(inputs: ProjectionInputs, mix: MixSettings, on: boolean, currentYear: number, person1Age: number | null, runs: number = MC_RUNS): Outlook {
  const planIn = planInputs(inputs, mix)
  const plan = runProjections(planIn)
  const main = mainOf(plan)
  const years = main.nwArr.length
  const lasts = (r: ProjectionResult) => r.shortfallYr === null && r.bridgeShortYr === null
  const ageAt = (yr: number | null) => (yr !== null && person1Age !== null ? person1Age + (yr - currentYear) : null)
  const flat = (a: number[]): Band => ({ low: a, high: a })
  const end = main.nwArr[years - 1] ?? 0
  const shortAgeMid = ageAt(main.shortfallYr ?? main.bridgeShortYr)

  if (!on || runs <= 0) {
    const withSuper = main.nwArr.map((v, i) => v + (main.superArr[i] ?? 0))
    return { plan, on: false, runs: 0, netWorth: flat(main.nwArr), netWorthWithSuper: flat(withSuper), super: flat(main.superArr),
      endNetWorth: { low: end, mid: end, high: end }, chanceLasts: inputs.lifeCourse ? (lasts(main) ? 1 : 0) : null,
      shortAgeLow: shortAgeMid, shortAgeMid }
  }

  const path = mixPath(mix, years, yearsToLastRetirement(inputs))
  const vols = path.map(mixVolatility)
  const investMedian = planIn.investReturnByYear ?? Array(years).fill(inputs.investReturn)
  const superMedian = inputs.lifeCourse ? (planIn.superReturnByYear ?? Array(years).fill(inputs.lifeCourse.superReturn)) : null
  const z = normals(SEED, runs * years)

  const nw: number[][] = [], nwSuper: number[][] = [], sup: number[][] = []
  const shortAges: number[] = []
  let lasting = 0
  for (let k = 0; k < runs; k++) {
    const zk = (y: number) => z[k * years + y]
    const r = mainOf(runProjections({
      ...planIn, mainOnly: true,
      investReturnByYear: investMedian.map((m, y) => drawReturn(m / 100, vols[y], zk(y)) * 100),
      superReturnByYear: superMedian?.map((m, y) => drawReturn(m, vols[y], zk(y))),
    }))
    nw.push(r.nwArr); sup.push(r.superArr); nwSuper.push(r.nwArr.map((v, i) => v + (r.superArr[i] ?? 0)))
    if (lasts(r)) lasting++
    shortAges.push(ageAt(r.shortfallYr ?? r.bridgeShortYr) ?? Infinity)
  }
  const nwBand = band(nw, years)
  const lowAge = pct([...shortAges].sort((a, b) => a - b), 0.1)
  return {
    plan, on: true, runs,
    netWorth: nwBand, netWorthWithSuper: band(nwSuper, years), super: band(sup, years),
    endNetWorth: { low: nwBand.low[years - 1] ?? end, mid: end, high: nwBand.high[years - 1] ?? end },
    chanceLasts: inputs.lifeCourse ? lasting / runs : null,
    shortAgeLow: Number.isFinite(lowAge) ? lowAge : null,
    shortAgeMid,
  }
}

/** "9 in 10", "about 3 in 4", "almost all": plain words for a chance. */
export function chanceWords(p: number): string {
  if (p >= 0.99) return 'almost all'
  if (p <= 0.01) return 'almost none'
  const tenths = Math.min(9, Math.max(1, Math.round(p * 10)))
  return `about ${tenths} in 10`
}
