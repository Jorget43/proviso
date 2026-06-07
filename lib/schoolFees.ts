export interface FeeLevel {
  tuition: number;
  fixed:   number;
}

export type FeeSchedule = Record<string, FeeLevel>;

// Default fee schedule (generic Australian independent school baseline).
// Used as a fallback and as the seed source — users can override via the DB.
export const SF_BASE: FeeSchedule = {
  'Kindergarten': { tuition:  6000, fixed:  600 },
  'Prep':         { tuition:  9000, fixed: 1100 },
  'Class 1':      { tuition: 10000, fixed:  800 },
  'Class 2':      { tuition: 10000, fixed:  800 },
  'Class 3':      { tuition: 11500, fixed: 1100 },
  'Class 4':      { tuition: 11500, fixed: 1500 },
  'Class 5':      { tuition: 11500, fixed: 1200 },
  'Class 6':      { tuition: 11500, fixed: 1500 },
  'Year 7':       { tuition: 12500, fixed: 1900 },
  'Year 8':       { tuition: 12500, fixed: 2100 },
  'Year 9':       { tuition: 12500, fixed: 4000 },
  'Year 10':      { tuition: 13000, fixed: 2300 },
  'Year 11':      { tuition: 13500, fixed: 2700 },
  'Year 12':      { tuition: 14000, fixed: 2400 },
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
): SchoolFeeYear {
  const levels = Object.keys(schedule);
  const mult   = Math.pow(1 + inflRate / 100, yr - new Date().getFullYear());
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
