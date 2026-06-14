// Australian education cost presets — sourced from Futurity Invest 2026 report
// (2025 figures, K–12 13-year totals in today's dollars).
// Each preset generates a year-level FeeSchedule by scaling a distribution curve
// to match the reported 13-year total.

import type { FeeSchedule } from './schoolFees'

// SF_BASE total = ~182,500. These relative weights replicate the year-level
// scaling of a typical independent school (lower primary, higher senior years).
const INDEPENDENT_WEIGHTS = [
  6600, 10100, 10800, 10800, 12600, 13000, 12700, 13000,
  14400, 14600, 16500, 15300, 16200, 16400,
]

// Catholic schools have a tighter range — less spike in senior years.
const CATHOLIC_WEIGHTS = [
  8500, 9500, 10000, 10000, 11000, 11500, 11500, 12000,
  13500, 14000, 14500, 14500, 15000, 15000,
]

// Government schools are nearly flat — mostly ancillary costs (uniforms, excursions).
const GOVERNMENT_WEIGHTS = [
  7500, 8000, 8000, 8000, 8500, 8500, 8500, 9000,
  9500, 9500, 9500, 9500, 10000, 10000,
]

const LEVELS = [
  'Kindergarten','Prep','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6',
  'Year 7','Year 8','Year 9','Year 10','Year 11','Year 12',
]

function scaleToTotal(weights: number[], total: number): FeeSchedule {
  const weightSum = weights.reduce((s, w) => s + w, 0)
  const scale = total / weightSum
  const schedule: FeeSchedule = {}
  LEVELS.forEach((level, i) => {
    const scaled = weights[i] * scale
    // Split ~80% tuition / 20% fixed for independent; flatter for others
    const fixed = Math.round(scaled * 0.15)
    schedule[level] = { tuition: Math.round(scaled - fixed), fixed }
  })
  return schedule
}

export type SchoolType = 'government' | 'catholic' | 'independent'

export interface EducationPreset {
  label:    string
  total13:  number       // 2025 dollars, K–12 sum per child
  schedule: FeeSchedule
}

function makePreset(label: string, total: number, type: SchoolType): EducationPreset {
  const weights = type === 'government' ? GOVERNMENT_WEIGHTS
    : type === 'catholic' ? CATHOLIC_WEIGHTS
    : INDEPENDENT_WEIGHTS
  return { label, total13: total, schedule: scaleToTotal(weights, total) }
}

// Key: `${locationKey}|${type}`
export const EDUCATION_PRESETS: Record<string, EducationPreset> = {
  'act|government':    makePreset('ACT — Government',          106280, 'government'),
  'act|catholic':      makePreset('ACT — Catholic',            215633, 'catholic'),
  'act|independent':   makePreset('ACT — Independent',         352656, 'independent'),

  'nsw|government':    makePreset('NSW (Sydney) — Government', 150323, 'government'),
  'nsw|catholic':      makePreset('NSW (Sydney) — Catholic',   197349, 'catholic'),
  'nsw|independent':   makePreset('NSW (Sydney) — Independent',411108, 'independent'),

  'nsw_r|government':  makePreset('NSW (Regional) — Government',  89448, 'government'),
  'nsw_r|catholic':    makePreset('NSW (Regional) — Catholic',    148960, 'catholic'),
  'nsw_r|independent': makePreset('NSW (Regional) — Independent', 250900, 'independent'),

  'qld|government':    makePreset('QLD (Brisbane) — Government', 101064, 'government'),
  'qld|catholic':      makePreset('QLD (Brisbane) — Catholic',   202485, 'catholic'),
  'qld|independent':   makePreset('QLD (Brisbane) — Independent',369646, 'independent'),

  'qld_r|government':  makePreset('QLD (Regional) — Government',  90267, 'government'),
  'qld_r|catholic':    makePreset('QLD (Regional) — Catholic',    157805, 'catholic'),
  'qld_r|independent': makePreset('QLD (Regional) — Independent', 229369, 'independent'),

  'sa|government':     makePreset('SA (Adelaide) — Government',  114678, 'government'),
  'sa|catholic':       makePreset('SA (Adelaide) — Catholic',    185548, 'catholic'),
  'sa|independent':    makePreset('SA (Adelaide) — Independent', 302387, 'independent'),

  'sa_r|government':   makePreset('SA (Regional) — Government',   75600, 'government'),
  'sa_r|catholic':     makePreset('SA (Regional) — Catholic',     147044, 'catholic'),
  'sa_r|independent':  makePreset('SA (Regional) — Independent',  268134, 'independent'),

  'vic|government':    makePreset('VIC (Melbourne) — Government', 114126, 'government'),
  'vic|catholic':      makePreset('VIC (Melbourne) — Catholic',   198291, 'catholic'),
  'vic|independent':   makePreset('VIC (Melbourne) — Independent',388618, 'independent'),

  'vic_r|government':  makePreset('VIC (Regional) — Government',  77641, 'government'),
  'vic_r|catholic':    makePreset('VIC (Regional) — Catholic',    151423, 'catholic'),
  'vic_r|independent': makePreset('VIC (Regional) — Independent', 247714, 'independent'),

  'wa|government':     makePreset('WA (Perth) — Government',  122106, 'government'),
  'wa|catholic':       makePreset('WA (Perth) — Catholic',    192613, 'catholic'),
  'wa|independent':    makePreset('WA (Perth) — Independent', 300109, 'independent'),

  'wa_r|government':   makePreset('WA (Regional) — Government',  78788, 'government'),
  'wa_r|catholic':     makePreset('WA (Regional) — Catholic',    150281, 'catholic'),
  'wa_r|independent':  makePreset('WA (Regional) — Independent', 277862, 'independent'),

  'nt|government':     makePreset('NT — Government',   75798, 'government'),
  'nt|catholic':       makePreset('NT — Catholic',    155594, 'catholic'),
  'nt|independent':    makePreset('NT — Independent', 245300, 'independent'),

  'tas|government':    makePreset('TAS — Government',   78869, 'government'),
  'tas|catholic':      makePreset('TAS — Catholic',    145870, 'catholic'),
  'tas|independent':   makePreset('TAS — Independent', 251561, 'independent'),
}

export const LOCATION_OPTIONS: { key: string; label: string }[] = [
  { key: 'act',   label: 'ACT' },
  { key: 'nsw',   label: 'NSW (Sydney)' },
  { key: 'nsw_r', label: 'NSW (Regional)' },
  { key: 'qld',   label: 'QLD (Brisbane)' },
  { key: 'qld_r', label: 'QLD (Regional)' },
  { key: 'sa',    label: 'SA (Adelaide)' },
  { key: 'sa_r',  label: 'SA (Regional)' },
  { key: 'vic',   label: 'VIC (Melbourne)' },
  { key: 'vic_r', label: 'VIC (Regional)' },
  { key: 'wa',    label: 'WA (Perth)' },
  { key: 'wa_r',  label: 'WA (Regional)' },
  { key: 'nt',    label: 'NT' },
  { key: 'tas',   label: 'TAS' },
]

export function presetScheduleFor(presetKey: string): FeeSchedule | null {
  return EDUCATION_PRESETS[presetKey]?.schedule ?? null
}

export function presetTotalFor(presetKey: string): number | null {
  return EDUCATION_PRESETS[presetKey]?.total13 ?? null
}
