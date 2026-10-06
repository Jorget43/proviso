// Monthly mortgage simulation with live offset.
// Offset updates EVERY MONTH — cash balance changes monthly from net flow.
// Do not simplify to annual offset; the monthly calculation is intentional.

/**
 * Standard amortised monthly repayment for a principal-and-interest loan.
 *
 * @param balance   Outstanding principal
 * @param ratePct   Annual interest rate as a percentage (e.g. 6.25)
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
  annualPaid:      number;  // repayments actually made (0 once the loan is cleared)
  unfunded:        number;  // spending cash couldn't cover (cash stops at 0); the caller funds or carries it
}

/**
 * Simulate one year of mortgage payments with live offset.
 *
 * Repayments come out of `cash` here, month by month, and stop the month the
 * loan is cleared (the final payment is only what's still owed). So callers
 * must NOT also count the repayment in their expenses.
 *
 * @param mb              Mortgage balance at start of year
 * @param cash            Cash/offset balance at start of year
 * @param rate            Annual interest rate as decimal (e.g. 0.0625)
 * @param payment         Scheduled monthly repayment
 * @param monthlyNetFlow  Net cash in/out per month EXCLUDING mortgage repayments
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
  let annualPaid      = 0;
  let unfunded        = 0;

  for (let mo = 0; mo < 12; mo++) {
    let paid = 0;
    if (mb > 0) {
      const effectiveBal  = Math.max(0, mb - cash);
      const monthInterest = effectiveBal * (rate / 12);
      paid                = Math.min(payment, mb + monthInterest);
      const principal     = Math.max(0, paid - monthInterest);
      annualInterest     += monthInterest;
      annualPrincipal    += principal;
      mb                  = Math.max(0, mb - principal);
    }
    annualPaid += paid;
    cash       += monthlyNetFlow - paid;
    if (cash < 0) { unfunded += -cash; cash = 0; }
  }

  return { endBalance: mb, endCash: cash, annualInterest, annualPrincipal, annualPaid, unfunded };
}

/**
 * Months until a loan is repaid at this monthly payment (interest monthly,
 * ignoring any offset). null when the payment doesn't cover the interest,
 * or the loan would run past 50 years.
 */
export function monthsToRepay(balance: number, ratePct: number, payment: number): number | null {
  if (balance <= 0) return 0;
  if (payment <= 0) return null;
  const r = ratePct / 100 / 12;
  if (r === 0) return Math.ceil(balance / payment);
  if (payment <= balance * r) return null;
  const months = Math.ceil(-Math.log(1 - (r * balance) / payment) / Math.log(1 + r));
  return months > 600 ? null : months;
}
