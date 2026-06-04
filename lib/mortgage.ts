// Monthly mortgage simulation with live offset.
// Offset updates EVERY MONTH — cash balance changes monthly from net flow.
// Do not simplify to annual offset; the monthly calculation is intentional.

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
