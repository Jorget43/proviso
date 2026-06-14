// Monthly mortgage simulation with live offset.
// Offset updates EVERY MONTH — cash balance changes monthly from net flow.
// Do not simplify to annual offset; the monthly calculation is intentional.

/**
 * Standard amortised monthly repayment for a principal-and-interest loan.
 *
 * @param balance   Outstanding principal
 * @param ratePct   Annual interest rate as a percentage (e.g. 5.99)
 * @param months    Number of monthly payments remaining
 * @returns         Monthly repayment, rounded to whole dollars; 0 if inputs invalid
 */
export function computeMonthlyRepayment(balance: number, ratePct: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return Math.round(balance / months);
  const payment = balance * r / (1 - Math.pow(1 + r, -months));
  return Math.round(payment);
}

/** Whole months between now and an ISO end date (floored at 0). */
export function monthsUntil(endDate: string, from: Date = new Date()): number {
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return 0;
  const months = (end.getFullYear() - from.getFullYear()) * 12 + (end.getMonth() - from.getMonth());
  return Math.max(0, months);
}

export interface MortgageYearResult {
  endBalance:      number;
  endCash:         number;
  annualInterest:  number;
  annualPrincipal: number;
}

/**
 * Simulate one year of mortgage payments with live offset.
 *
 * @param mb              Mortgage balance at start of year
 * @param cash            Cash/offset balance at start of year
 * @param rate            Annual interest rate as decimal (e.g. 0.0599)
 * @param payment         Fixed monthly repayment amount
 * @param monthlyNetFlow  Net cash in/out per month (income minus all expenses
 *                        including the mortgage repayment line item)
 */
export function simulateMortgageYear(
  mb:              number,
  cash:            number,
  rate:            number,
  payment:         number,
  monthlyNetFlow:  number,
): MortgageYearResult {
  let annualInterest  = 0;
  let annualPrincipal = 0;

  for (let mo = 0; mo < 12; mo++) {
    const effectiveBal   = Math.max(0, mb - cash);
    const monthInterest  = effectiveBal * (rate / 12);
    annualInterest      += monthInterest;
    const principal      = Math.max(0, payment - monthInterest);
    annualPrincipal     += principal;
    mb                   = Math.max(0, mb - principal);
    cash                += monthlyNetFlow;
    cash                 = Math.max(0, cash);
  }

  return { endBalance: mb, endCash: cash, annualInterest, annualPrincipal };
}
