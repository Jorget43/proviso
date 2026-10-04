// 17 pre-loaded life phase expense overlays
// Childcare-named phases inflate at childcareInflRate; all others at inflRate
// endYear >= 2090 is treated as "ongoing indefinitely" (displayed as ∞ in UI, stored as 2100 in DB)
// oneoff phases: monthlyAmt is the total lump sum (not monthly × 12)

import { MODEL_BASE_YEAR } from './constants';

export interface LifePhase {
  id:          number;
  name:        string;
  type:        'recurring' | 'oneoff' | 'phaseout';
  monthlyAmt:  number;   // negative for phaseouts; total for oneoff
  startYear:   number;
  endYear:     number;   // 2100 = ongoing indefinitely
  cat:         string;
  enabled:     boolean;
  sortOrder?:  number;
}


/**
 * Total annual cost overlay for all life phases in a given year.
 *
 * Childcare-named phases (daycare, childcare, school care) inflate at
 * childcareInflRate; all other phases inflate at inflRate.
 *
 * @param yr                Calendar year
 * @param phases            Active life phases array (from the DB)
 * @param inflRate          General expense inflation as percent (e.g. 2.5)
 * @param childcareInflRate Childcare-specific inflation as percent (e.g. 6.0)
 */
export function lifePhaseCostForYear(
  yr:                number,
  phases:            LifePhase[],
  inflRate:          number,
  childcareInflRate: number = inflRate,
  baseYear:          number = MODEL_BASE_YEAR,
): number {
  let total = 0;

  for (const p of phases) {
    if (!p.enabled) continue;
    if (yr < p.startYear || yr > p.endYear) continue;

    const isChildcare =
      p.cat === 'Children' &&
      (p.name.toLowerCase().includes('daycare') ||
       p.name.toLowerCase().includes('childcare') ||
       p.name.toLowerCase().includes('school care'));

    const rate = isChildcare ? childcareInflRate : inflRate;
    // Life-phase amounts are denominated as of MODEL_BASE_YEAR — see
    // its doc comment in lib/constants.ts.
    const mult = Math.pow(1 + rate / 100, yr - baseYear);

    if (p.type === 'oneoff') {
      total += p.monthlyAmt * mult;
    } else {
      total += p.monthlyAmt * 12 * mult;
    }
  }

  return total;
}
