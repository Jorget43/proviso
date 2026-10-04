// Australian resident individual tax — FY2026-27 (1 Jul 2026 – 30 Jun 2027).
// Every constant here is tracked by the assumptions watchdog (lib/watchdog.ts);
// when a new FY's figures land, update them together and bump TAX_FY.

// Financial year (ending) these figures are calibrated for.
export const TAX_FY = 2027;

// Stage 3 scale with the 16% → 15% cut from 1 Jul 2026 (14% from 1 Jul 2027).
export const TAX_THRESHOLDS = [0, 18200, 45000, 135000, 190000];
export const TAX_RATES      = [0, 0.15,  0.30,  0.37,   0.45];

// Medicare levy: 2%, with the low-income reduction (single). No levy at or
// below the lower threshold; between it and the upper threshold the levy is
// 10c per $1 over the lower threshold (shade-in), which meets 2% at the upper
// one. Family/senior thresholds and the surcharge aren't modelled.
export const MEDICARE_RATE        = 0.02;
export const MEDICARE_LOW_THRESH  = 28011;
export const MEDICARE_SHADE_RATE  = 0.10;
export const MEDICARE_UPPER_THRESH = 35013;

// HELP compulsory repayments — marginal system (since FY2025-26). Nothing up
// to the threshold; 15c per $1 above it; 17c per $1 above the second band;
// above the top threshold, 10% of total repayment income.
export const HELP_REPAY_THRESHOLD = 69528;
export const HELP_BAND2_THRESHOLD = 129717;
export const HELP_TOP_THRESHOLD   = 186050;
export const HELP_BAND1_RATE      = 0.15;
export const HELP_BAND2_RATE      = 0.17;
export const HELP_TOP_RATE        = 0.10;

// LITO: max $700, phases out $37,500–$45,000 (5c) then $45,000–$66,667 (1.5c).
// Unchanged since 2020-21.
export function calcLITO(gross: number): number {
  if (gross <= 37500) return 700;
  if (gross <= 45000) return 700 - (gross - 37500) * 0.05;
  if (gross <= 66667) return 325 - (gross - 45000) * 0.015;
  return 0;
}

// LMITO abolished from 2022-23 — not included

export function calcHELPRepayment(gross: number): number {
  if (gross <= HELP_REPAY_THRESHOLD) return 0;
  if (gross > HELP_TOP_THRESHOLD) return Math.round(gross * HELP_TOP_RATE);
  const band1 = (Math.min(gross, HELP_BAND2_THRESHOLD) - HELP_REPAY_THRESHOLD) * HELP_BAND1_RATE;
  const band2 = Math.max(0, gross - HELP_BAND2_THRESHOLD) * HELP_BAND2_RATE;
  return Math.round(band1 + band2);
}

export function calcIncomeTax(gross: number): number {
  if (gross <= 0) return 0;
  let tax = 0;
  for (let i = 0; i < TAX_THRESHOLDS.length; i++) {
    const lo = TAX_THRESHOLDS[i];
    const hi = i < TAX_THRESHOLDS.length - 1 ? TAX_THRESHOLDS[i + 1] : Infinity;
    if (gross > lo) tax += (Math.min(gross, hi) - lo) * TAX_RATES[i];
  }
  return Math.max(0, tax - calcLITO(gross));
}

export function calcMedicare(gross: number): number {
  if (gross <= MEDICARE_LOW_THRESH) return 0;
  return Math.min(gross * MEDICARE_RATE, (gross - MEDICARE_LOW_THRESH) * MEDICARE_SHADE_RATE);
}

export function calcAfterTax(gross: number, hasHELP = false): number {
  const tax      = calcIncomeTax(gross);
  const medicare = calcMedicare(gross);
  const help     = hasHELP ? calcHELPRepayment(gross) : 0;
  return gross - tax - medicare - help;
}

export function effectiveRate(gross: number, hasHELP = false): number {
  if (gross <= 0) return 0;
  return (gross - calcAfterTax(gross, hasHELP)) / gross;
}

// Returns the bracket's marginal rate plus the full Medicare levy. Ignores the
// LITO taper and the Medicare shade-in band — used for salary-sacrifice and
// "pre-tax equivalent return" guidance, where the headline rate is what matters.
export function marginalRate(gross: number): number {
  for (let i = TAX_THRESHOLDS.length - 1; i >= 1; i--) {
    if (gross > TAX_THRESHOLDS[i]) return TAX_RATES[i] + MEDICARE_RATE;
  }
  return MEDICARE_RATE;
}
