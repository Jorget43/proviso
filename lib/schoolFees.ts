// Melbourne Rudolf Steiner School, Warranwood — 2026 fee schedule
// Sibling discount: 15% on Child 2 tuition while both enrolled
// Capital Maintenance Levy (CML): $350/family/yr, inflated from 2026 base
// Year 12 tuition 2026: $13,870 (verified against fee schedule)

export interface FeeLevel {
  tuition: number;
  fixed:   number;
}

export const SF_BASE: Record<string, FeeLevel> = {
  'Kindergarten': { tuition:  5790, fixed:  590 },
  'Prep':         { tuition:  8830, fixed: 1080 },
  'Class 1':      { tuition:  9910, fixed:  750 },
  'Class 2':      { tuition:  9910, fixed:  750 },
  'Class 3':      { tuition: 11340, fixed: 1030 },
  'Class 4':      { tuition: 11340, fixed: 1430 },
  'Class 5':      { tuition: 11340, fixed: 1150 },
  'Class 6':      { tuition: 11340, fixed: 1500 },
  'Class 7':      { tuition: 12300, fixed: 1830 },
  'Class 8':      { tuition: 12300, fixed: 2040 },
  'Year 9':       { tuition: 12150, fixed: 3970 },
  'Year 10':      { tuition: 12750, fixed: 2260 },
  'Year 11':      { tuition: 13150, fixed: 2600 },
  'Year 12':      { tuition: 13870, fixed: 2300 },
};

export const SF_LEVELS       = Object.keys(SF_BASE); // ordered Kinder → Year 12
export const SF_SIBLING_DISC = 0.15;                 // 15% discount on Child 2 tuition only
export const SF_CML_BASE     = 350;                  // Capital Maintenance Levy base 2026

export interface SchoolFeeYear {
  total:      number;
  c1:         number;
  c2:         number;
  sibSaving:  number;
  cml:        number;
}

/**
 * Calculate annual school fees for a given year.
 *
 * @param yr          Calendar year to calculate
 * @param c1Start     Year Child 1 starts Kindergarten
 * @param c1ExitIdx   Year level index (0=Kinder, 13=Year 12) Child 1 exits after
 * @param c2Start     Year Child 2 starts Kindergarten
 * @param c2ExitIdx   Year level index Child 2 exits after
 * @param inflRate    Annual fee inflation rate as percent (e.g. 5.0)
 */
export function schoolFeesForYear(
  yr:         number,
  c1Start:    number,
  c1ExitIdx:  number,
  c2Start:    number,
  c2ExitIdx:  number,
  inflRate:   number,
): SchoolFeeYear {
  const mult   = Math.pow(1 + inflRate / 100, yr - 2026);
  const c1Idx  = yr - c1Start;
  const c2Idx  = yr - c2Start;
  const c1Active = c1Idx >= 0 && c1Idx < SF_LEVELS.length && c1Idx <= c1ExitIdx;
  const c2Active = c2Idx >= 0 && c2Idx < SF_LEVELS.length && c2Idx <= c2ExitIdx;

  if (!c1Active && !c2Active) return { total: 0, c1: 0, c2: 0, sibSaving: 0, cml: 0 };

  let c1Fee = 0, c2Fee = 0, sibSaving = 0;

  if (c1Active) {
    const b = SF_BASE[SF_LEVELS[c1Idx]];
    c1Fee = (b.tuition + b.fixed) * mult;
  }
  if (c2Active) {
    const b    = SF_BASE[SF_LEVELS[c2Idx]];
    const disc = c1Active ? b.tuition * mult * SF_SIBLING_DISC : 0;
    sibSaving  = disc;
    c2Fee      = (b.tuition + b.fixed) * mult - disc;
  }

  const cml = SF_CML_BASE * mult;
  return { total: c1Fee + c2Fee + cml, c1: c1Fee, c2: c2Fee, sibSaving, cml };
}
