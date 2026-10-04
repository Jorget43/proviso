// 2024-25 Stage 3 tax brackets (effective 1 Jul 2024)
// Source: ATO 2024-25, verified against paycalculator.com.au

export const TAX_THRESHOLDS_2425 = [0, 18200, 45000, 135000, 190000];
export const TAX_RATES_2425      = [0, 0.16,  0.30,  0.37,   0.45];
export const MEDICARE_RATE       = 0.02;
export const MEDICARE_LOW_THRESH = 26000;

// HELP repayment thresholds 2024-25 (ATO Schedule 1)
export const HELP_THRESHOLDS: [number, number][] = [
  [54435,  0.010], [62851,  0.020], [66621,  0.025], [70619,  0.030],
  [74856,  0.035], [79347,  0.040], [84737,  0.045], [90143,  0.050],
  [95674,  0.055], [101900, 0.060], [107000, 0.065], [114232, 0.070],
  [121570, 0.075], [129813, 0.080], [138450, 0.085], [147175, 0.090],
  [156631, 0.095], [167206, 0.100],
];

// LITO 2024-25: max $700, phases out $37,500–$45,000 then $45,000–$66,667
export function calcLITO(gross: number): number {
  if (gross <= 37500) return 700;
  if (gross <= 45000) return 700 - (gross - 37500) * 0.05;
  if (gross <= 66667) return 325 - (gross - 45000) * 0.015;
  return 0;
}

// LMITO abolished from 2022-23 — not included

export function calcHELPRepayment(gross: number): number {
  for (let i = HELP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (gross >= HELP_THRESHOLDS[i][0]) return Math.round(gross * HELP_THRESHOLDS[i][1]);
  }
  return 0;
}

export function calcIncomeTax(gross: number): number {
  if (gross <= 0) return 0;
  let tax = 0;
  for (let i = 0; i < TAX_THRESHOLDS_2425.length; i++) {
    const lo = TAX_THRESHOLDS_2425[i];
    const hi = i < TAX_THRESHOLDS_2425.length - 1 ? TAX_THRESHOLDS_2425[i + 1] : Infinity;
    if (gross > lo) tax += (Math.min(gross, hi) - lo) * TAX_RATES_2425[i];
  }
  return Math.max(0, tax - calcLITO(gross));
}

export function calcMedicare(gross: number): number {
  if (gross <= MEDICARE_LOW_THRESH) return 0;
  return gross * MEDICARE_RATE;
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

// Returns marginal rate including Medicare levy
export function marginalRate(gross: number): number {
  const thresholds = [18200, 45000, 135000, 190000];
  const rates      = [0.16,  0.30,  0.37,   0.45];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (gross > thresholds[i]) return rates[i] + MEDICARE_RATE;
  }
  return MEDICARE_RATE;
}
