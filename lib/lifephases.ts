// 17 pre-loaded life phase expense overlays
// Childcare-named phases inflate at childcareInflRate; all others at inflRate
// endYear >= 2090 is treated as "ongoing indefinitely" (displayed as ∞ in UI, stored as 2100 in DB)
// oneoff phases: monthlyAmt is the total lump sum (not monthly × 12)

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

export const DEFAULT_LIFE_PHASES: LifePhase[] = [
  { id: 500, name: 'Baby 2 — OB & hospital (private)',                  type: 'oneoff',    monthlyAmt:  8000, startYear: 2028, endYear: 2028, cat: 'Children',  enabled: true },
  { id: 501, name: 'Baby 2 newborn consumables',                        type: 'recurring', monthlyAmt:   500, startYear: 2028, endYear: 2030, cat: 'Children',  enabled: true },
  { id: 502, name: 'Daycare — Child 2',                                 type: 'recurring', monthlyAmt:   900, startYear: 2029, endYear: 2032, cat: 'Children',  enabled: true },
  { id: 503, name: 'Childcare phase-out (Child 1 starts school)',       type: 'phaseout',  monthlyAmt:  -800, startYear: 2029, endYear: 2029, cat: 'Children',  enabled: true },
  { id: 504, name: 'Grocery uplift — family of 4',                      type: 'recurring', monthlyAmt:   300, startYear: 2028, endYear: 2100, cat: 'Food',      enabled: true },
  { id: 505, name: 'Utilities uplift — 4 people',                       type: 'recurring', monthlyAmt:   100, startYear: 2028, endYear: 2100, cat: 'Utilities', enabled: true },
  { id: 506, name: 'Petrol uplift — school runs & activities',          type: 'recurring', monthlyAmt:   120, startYear: 2028, endYear: 2100, cat: 'Transport', enabled: true },
  { id: 507, name: 'Kids clothing — growing children',                  type: 'recurring', monthlyAmt:   200, startYear: 2028, endYear: 2042, cat: 'Children',  enabled: true },
  { id: 508, name: 'Holiday uplift — family of 4',                      type: 'recurring', monthlyAmt:   250, startYear: 2028, endYear: 2100, cat: 'Fun',       enabled: true },
  { id: 509, name: 'Kids activities — 1 child (sport, music, parties)', type: 'recurring', monthlyAmt:   350, startYear: 2029, endYear: 2034, cat: 'Children',  enabled: true },
  { id: 510, name: 'Kids activities — 2 children',                      type: 'recurring', monthlyAmt:   700, startYear: 2032, endYear: 2044, cat: 'Children',  enabled: true },
  { id: 511, name: 'Birthday parties & gifts — kids',                   type: 'recurring', monthlyAmt:   150, startYear: 2028, endYear: 2040, cat: 'Fun',       enabled: true },
  { id: 512, name: 'School camps & excursions',                         type: 'recurring', monthlyAmt:   200, startYear: 2030, endYear: 2044, cat: 'Children',  enabled: true },
  { id: 513, name: 'Health insurance step-up (job change)',             type: 'recurring', monthlyAmt:   253, startYear: 2030, endYear: 2100, cat: 'Insurance', enabled: true },
  { id: 514, name: 'Before/after school care — Child 1',                type: 'recurring', monthlyAmt:   400, startYear: 2034, endYear: 2037, cat: 'Children',  enabled: true },
  { id: 515, name: 'Before/after school care — Child 2',                type: 'recurring', monthlyAmt:   400, startYear: 2037, endYear: 2040, cat: 'Children',  enabled: true },
  { id: 516, name: 'Teen uplift — food, phone, social, transport, driving', type: 'recurring', monthlyAmt: 500, startYear: 2038, endYear: 2044, cat: 'Children', enabled: true },
];

/**
 * Total annual cost overlay for all life phases in a given year.
 *
 * Childcare-named phases (daycare, childcare, school care) inflate at
 * childcareInflRate; all other phases inflate at inflRate.
 *
 * @param yr                Calendar year
 * @param phases            Active life phases array (DB or DEFAULT_LIFE_PHASES)
 * @param inflRate          General expense inflation as percent (e.g. 2.5)
 * @param childcareInflRate Childcare-specific inflation as percent (e.g. 6.0)
 */
export function lifePhaseCostForYear(
  yr:                number,
  phases:            LifePhase[],
  inflRate:          number,
  childcareInflRate: number = inflRate,
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
    const mult = Math.pow(1 + rate / 100, yr - 2026);

    if (p.type === 'oneoff') {
      total += p.monthlyAmt * mult;
    } else {
      total += p.monthlyAmt * 12 * mult;
    }
  }

  return total;
}
