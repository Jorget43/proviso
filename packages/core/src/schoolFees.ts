import { MODEL_BASE_YEAR } from './constants';

export interface FeeLevel {
  tuition: number;
  fixed:   number;
}

export type FeeSchedule = Record<string, FeeLevel>;

// Default fee schedule (generic Australian independent school baseline).
// Used as a fallback and as the seed source — users can override via the DB.
export const SF_BASE: FeeSchedule = {
  'Kindergarten': { tuition:  5000, fixed:  500 },
  'Prep':         { tuition:  8000, fixed: 1000 },
  'Year 1':       { tuition:  9000, fixed: 1000 },
  'Year 2':       { tuition:  9000, fixed: 1000 },
  'Year 3':       { tuition: 10000, fixed: 1000 },
  'Year 4':       { tuition: 10000, fixed: 1000 },
  'Year 5':       { tuition: 10500, fixed: 1000 },
  'Year 6':       { tuition: 10500, fixed: 1000 },
  'Year 7':       { tuition: 12000, fixed: 1500 },
  'Year 8':       { tuition: 12000, fixed: 1500 },
  'Year 9':       { tuition: 12000, fixed: 2000 },
  'Year 10':      { tuition: 13000, fixed: 2000 },
  'Year 11':      { tuition: 14000, fixed: 2000 },
  'Year 12':      { tuition: 14000, fixed: 2000 },
};

export const SF_LEVELS       = Object.keys(SF_BASE);
export const SF_SIBLING_DISC = 0.15;
export const SF_CML_BASE     = 350;

export interface SchoolFeeYear {
  total:      number;
  c1:         number;
  c2:         number;
  sibSaving:  number;
  cml:        number;
}

export function schoolFeesForYear(
  yr:         number,
  c1Start:    number,
  c1ExitIdx:  number,
  c2Start:    number,
  c2ExitIdx:  number,
  inflRate:   number,
  schedule:   FeeSchedule = SF_BASE,
  baseYear:   number = MODEL_BASE_YEAR,
): SchoolFeeYear {
  const levels = Object.keys(schedule);
  // Inflation compounds from the schedule's data vintage (MODEL_BASE_YEAR), not
  // the wall clock — see MODEL_BASE_YEAR's doc comment in lib/constants.ts.
  const mult   = Math.pow(1 + inflRate / 100, yr - baseYear);
  const c1Idx  = yr - c1Start;
  const c2Idx  = yr - c2Start;
  const c1Active = c1Idx >= 0 && c1Idx < levels.length && c1Idx <= c1ExitIdx;
  const c2Active = c2Idx >= 0 && c2Idx < levels.length && c2Idx <= c2ExitIdx;

  if (!c1Active && !c2Active) return { total: 0, c1: 0, c2: 0, sibSaving: 0, cml: 0 };

  let c1Fee = 0, c2Fee = 0, sibSaving = 0;

  if (c1Active) {
    const b = schedule[levels[c1Idx]];
    c1Fee = (b.tuition + b.fixed) * mult;
  }
  if (c2Active) {
    const b    = schedule[levels[c2Idx]];
    const disc = c1Active ? b.tuition * mult * SF_SIBLING_DISC : 0;
    sibSaving  = disc;
    c2Fee      = (b.tuition + b.fixed) * mult - disc;
  }

  const cml = SF_CML_BASE * mult;
  return { total: c1Fee + c2Fee + cml, c1: c1Fee, c2: c2Fee, sibSaving, cml };
}

// ── School fees v2 (plan item 7): any number of children, a primary and a
// secondary school each, and the household's own fee rules ────────────────

/** A stage's school: a typical school of that type where you live, your own fee table, or none modelled. */
export type SchoolChoice = 'government' | 'catholic' | 'independent' | 'custom' | 'none'
export const SCHOOL_CHOICES: readonly SchoolChoice[] = ['government', 'catholic', 'independent', 'custom', 'none']
export const asSchoolChoice = (v: unknown): SchoolChoice | null => (SCHOOL_CHOICES.includes(v as SchoolChoice) ? v as SchoolChoice : null)

/** Secondary school starts at this schedule level ('Year 7'); everything before it is primary (Kinder–Year 6). */
export const SECONDARY_FROM_IDX = 8

/** One child's school years, as the engine needs them. */
export interface SchoolKid {
  /** The year they're at the schedule's first level (Kindergarten). */
  start:     number
  /** The last schedule level they attend (13 = Year 12). */
  exitIdx:   number
  /** Fee tables for each stage; null when that stage isn't modelled. */
  primary:   FeeSchedule | null
  secondary: FeeSchedule | null
  /** What each stage is, so moving to a different school charges an entry fee. */
  primaryChoice:   SchoolChoice
  secondaryChoice: SchoolChoice
}

/** The household's fee rules (the school's terms, entered by the household). */
export interface SchoolFeeRules {
  /** Off tuition for the 2nd, 3rd and 4th-or-later child at school in the same year, in %. */
  siblingPct: [number, number, number]
  /** A flat yearly family fee (building fund, levy) while any child is at school, today's dollars. */
  familyFee:  number
  /** A one-off fee when a child starts at a school (enrolment, uniform), today's dollars. */
  entryFee:   number
}

/** The rules before v2: 15% off the second child's tuition and a $350 levy. */
export const LEGACY_FEE_RULES: SchoolFeeRules = { siblingPct: [SF_SIBLING_DISC * 100, SF_SIBLING_DISC * 100, SF_SIBLING_DISC * 100], familyFee: SF_CML_BASE, entryFee: 0 }

export interface SchoolFeesYear {
  total:     number
  /** Each child's fees after any sibling discount, entry fees included; same order as the kids. */
  perChild:  number[]
  sibSaving: number
  /** The family fee for the year. */
  family:    number
}

/**
 * One year's school fees for the household. Children at school that year are
 * counted in birth order (the kids' order): the eldest pays full tuition, the
 * next gets the 2nd-child discount, and so on. Fixed fees are never discounted.
 * Amounts inflate from the schedules' vintage (MODEL_BASE_YEAR).
 */
export function schoolFeesYear(yr: number, kids: SchoolKid[], rules: SchoolFeeRules, inflRate: number, baseYear: number = MODEL_BASE_YEAR): SchoolFeesYear {
  const mult = Math.pow(1 + inflRate / 100, yr - baseYear)
  const perChild = kids.map(() => 0)
  let sibSaving = 0, atSchool = 0
  kids.forEach((k, i) => {
    const idx = yr - k.start
    const secondary = idx >= SECONDARY_FROM_IDX
    const schedule = secondary ? k.secondary : k.primary
    if (!schedule || idx < 0 || idx > k.exitIdx) return
    const level = schedule[Object.keys(schedule)[idx]]
    if (!level) return
    const pct = atSchool === 0 ? 0 : rules.siblingPct[Math.min(atSchool, 3) - 1] ?? 0
    atSchool++
    const disc = level.tuition * mult * pct / 100
    // An entry fee when they start school, and again if secondary is a different school.
    const entry = idx === 0 || (idx === SECONDARY_FROM_IDX && k.secondaryChoice !== k.primaryChoice) ? rules.entryFee * mult : 0
    sibSaving += disc
    perChild[i] = (level.tuition + level.fixed) * mult - disc + entry
  })
  const family = atSchool > 0 ? rules.familyFee * mult : 0
  return { total: perChild.reduce((t, v) => t + v, 0) + family, perChild, sibSaving, family }
}
