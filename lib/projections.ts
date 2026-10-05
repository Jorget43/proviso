// 20-year dual simulation (with fees / without fees for comparison)
// Stepped inflation: near-term rate for 2026-28, long-run rate for 2029+
// Childcare phases use separate higher inflation rate (historically ~12%, modelled at 6%)
// Mortgage offset updates EVERY MONTH within the 12-month loop — do not simplify to annual
// Two runs: withFees (if schoolFeesOn) and base (always)

import { calcAfterTax, calcHELPRepayment } from './tax';
import { simulateMortgageYear, computeMonthlyRepayment } from './mortgage';
import { schoolFeesForYear, type FeeSchedule } from './schoolFees';
import { lifePhaseCostForYear } from './lifephases';
import type { LifePhase }       from './lifephases';
import { PPL_TOTAL, NEAR_TERM_INFLATION_HORIZON } from './constants';

export interface WorkPhase {
  year: number;
  days: number; // 0 = parental leave, 1-5 = days/week
}

export interface OneOff {
  name: string;
  amt:  number;
  year: number;
}

export interface ProjectionInputs {
  // Income
  person1FTE:         number;   // gross annual
  person2FTE:         number;   // gross annual FTE
  taxMode:            boolean;
  // HELP: a person's balance is repaid via compulsory repayments on their
  // gross income, indexed yearly, and counted as a debt in net worth.
  person1HasHELP:     boolean;
  person1HELPBalance: number;   // current HELP balance (from the Debts tab)
  person2HasHELP:     boolean;
  person2HELPBalance: number;
  person1MonthlyNet:  number;   // used in simple (non-tax) mode only
  person2MonthlyNet:  number;   // used in simple (non-tax) mode only

  // Growth & inflation — all as percent (e.g. 3.5 not 0.035)
  person1GrowthRate:  number;
  person2GrowthRate:  number;
  expInflNear:        number;   // near-term expense inflation 2026–2028
  expInfl:            number;   // long-run expense inflation 2029+
  childcareInfl:      number;
  propGrowth:         number;
  savingsRate:        number;   // % of annual surplus to invest
  investReturn:       number;

  projYears:          number;

  // Current balances
  mortBalance:        number;
  mortRate:           number;   // as percent (e.g. 6.25)
  mortPayment:        number;   // scheduled monthly repayment — paid until the loan clears
  cashOnHand:         number;
  propValue:          number;   // house value (mortgage balance + equity)
  cryptoValue:        number;
  // Everything else on the Own & owe lists, so the starting point matches the
  // net worth shown elsewhere (lib/netWorth.ts). Optional, default 0.
  investmentsValue?:  number;   // shares, other savings — the starting investment balance, grown at investReturn
  otherDebts?:        number;   // debts other than the mortgage and modelled HELP — held flat (repayments sit in the budget)

  // Work schedule phases — both persons
  person1Phases:      WorkPhase[];
  person2Phases:      WorkPhase[];

  // Expense base (monthly total) EXCLUDING mortgage repayments — those are
  // modelled from mortPayment and stop when the loan is paid off.
  baseMonthlyExpenses: number;

  // One-off home expenses
  oneoffs:            OneOff[];

  // Parental leave
  parentalLeaveEnabled: boolean;

  // School fees
  schoolFeesOn:       boolean;
  sfC1Start:          number;
  sfC1ExitIdx:        number;
  sfC2Start:          number;
  sfC2ExitIdx:        number;
  sfInfl:             number;
  sfSchedule?:        FeeSchedule;

  // Life phase overlays (the mutable set from DB or defaults)
  lifePhases:         LifePhase[];

  // Starting year (2026 at launch; current year used for phase lookup)
  currentYear:        number;

  // Renter mode — rent tracked separately from baseMonthlyExpenses
  rentMode:              boolean;
  monthlyRent:           number;  // current monthly rent (grows at rentIncreaseRate)
  rentIncreaseRate:      number;  // as percent per year (e.g. 5.0)
  // Purchase plan — renter transitioning to homeowner at a future year
  purchasePlanEnabled:   boolean;
  targetPurchaseYear:    number;
  targetPropertyValue:   number;
  depositPct:            number;  // % of property value
  depositFromCash:       number;
  depositFromInvestments: number; // triggers CGT — approx 12% haircut applied
  newMortgageRate:       number;  // as percent (e.g. 6.0)
  newMortgageTermYrs:    number;
}

export interface ProjectionResult {
  nwArr:          number[];
  incArr:         number[];
  expArr:         number[];
  mortArr:        number[];
  cashArr:        number[];
  investArr:      number[];
  person1Arr:       number[];
  person2Arr:       number[];
  phaseArr:       number[];
  deficitArr:     number[];
  cashRunningArr: number[];
  mortStressArr:  number[];
  sfC1Arr:        number[];
  sfC2Arr:        number[];
  sfSibArr:       number[];
  sfTotalArr:     number[];
  leaveYrs:       number[];
  person1HelpClearedYr: number | null;
  person2HelpClearedYr: number | null;
  rentArr:        number[];   // annual rent paid each year (0 for homeowners / post-purchase)
  purchaseYr:     number | null; // year of rent→own transition (null if no purchase plan)
}

export interface ProjectionOutput {
  base:      ProjectionResult;
  withFees:  ProjectionResult | null;
  labels:    string[];           // calendar year strings e.g. ['2027', '2028', ...]
}

function getSortedPhases(phases: WorkPhase[]): WorkPhase[] {
  return [...phases].sort((a, b) => a.year - b.year);
}

function getPhaseForYear(yr: number, sortedPhases: WorkPhase[]): WorkPhase {
  let p = sortedPhases[0];
  for (const x of sortedPhases) {
    if (x.year <= yr) p = x;
  }
  return p;
}

// Days/week worked in `year`: the latest phase starting on or before it (a
// phase stays in force until the next one), defaulting to full-time when no
// phases exist. Shared by the Budget/Cashflow/Debts pages so the "current"
// income they show matches the projection's year-by-year income.
export function workDaysForYear(phases: WorkPhase[], year: number): number {
  if (phases.length === 0) return 5
  return getPhaseForYear(year, getSortedPhases(phases)).days
}



export function runProjections(inputs: ProjectionInputs): ProjectionOutput {
  const {
    person1FTE, person2FTE, taxMode, person1HasHELP, person2HasHELP,
    person1MonthlyNet, person2MonthlyNet,
    person1GrowthRate, person2GrowthRate,
    expInflNear, expInfl, childcareInfl,
    propGrowth, savingsRate, investReturn,
    projYears,
    mortBalance, mortRate, mortPayment, cashOnHand, propValue, cryptoValue,
    person1Phases, person2Phases, baseMonthlyExpenses, oneoffs,
    parentalLeaveEnabled,
    schoolFeesOn, sfC1Start, sfC1ExitIdx, sfC2Start, sfC2ExitIdx, sfInfl, sfSchedule,
    lifePhases, currentYear,
    rentMode, monthlyRent, rentIncreaseRate,
    purchasePlanEnabled, targetPurchaseYear, targetPropertyValue, depositPct,
    depositFromCash, depositFromInvestments, newMortgageRate, newMortgageTermYrs,
  } = inputs;

  const cy          = currentYear;
  const labels      = Array.from({ length: projYears }, (_, i) => String(cy + i + 1));
  const sorted      = getSortedPhases(person2Phases.length > 0 ? person2Phases : [{ year: cy, days: 5 }]);
  const sortedPerson1 = getSortedPhases(person1Phases.length > 0 ? person1Phases : [{ year: cy, days: 5 }]);
  const leaveSt     = new Set(sorted.filter(p => p.days === 0).map(p => p.year));

  const jG  = person1GrowthRate / 100;
  const gG  = person2GrowthRate / 100;
  const eINear = expInflNear  / 100;
  const eI     = expInfl      / 100;
  const cI     = childcareInfl / 100;
  const pG     = propGrowth   / 100;
  const sR     = savingsRate  / 100;
  const iR     = investReturn / 100;
  const mRate  = mortRate     / 100;

  function inflRateForYear(yr: number): number {
    return yr <= NEAR_TERM_INFLATION_HORIZON ? eINear : eI;
  }

  // Gross base salaries for projection
  const p1GrossBase = taxMode ? person1FTE : person1MonthlyNet * 12 / 0.72;
  const p2GrossBase = taxMode ? person2FTE  : person2MonthlyNet * 12 / 0.72;

  function runProjection(includeSchoolFees: boolean): ProjectionResult {
    let expBase   = baseMonthlyExpenses * 12;
    let mb        = rentMode ? 0 : mortBalance;
    let pVal      = rentMode ? 0 : propValue;
    let cash      = cashOnHand;
    let invest    = Math.max(0, inputs.investmentsValue ?? 0);
    const crypto  = cryptoValue;
    const otherDebts = Math.max(0, inputs.otherDebts ?? 0);
    let p1HELP    = person1HasHELP ? Math.max(0, inputs.person1HELPBalance) : 0;
    let p2HELP    = person2HasHELP ? Math.max(0, inputs.person2HELPBalance) : 0;

    // Renter state — tracked locally so we can mutate through the year loop
    let isRenting      = rentMode;
    let rentAnnual     = monthlyRent * 12;
    let lMortRate      = rentMode ? 0 : mRate;   // local (may change at purchase year)
    let lMortPayment   = rentMode ? 0 : mortPayment;
    // PPL is set at the national minimum wage, which is reindexed each July;
    // expense inflation stands in for that from the current rate onward.
    let pplIndex       = 1;

    const nwArr:          number[] = [];
    const incArr:         number[] = [];
    const expArr:         number[] = [];
    const mortArr:        number[] = [];
    const cashArr:        number[] = [];
    const investArr:      number[] = [];
    const person1Arr:       number[] = [];
    const person2Arr:       number[] = [];
    const phaseArr:       number[] = [];
    const deficitArr:     number[] = [];
    const cashRunningArr: number[] = [];
    const mortStressArr:  number[] = [];
    const sfC1Arr:        number[] = [];
    const sfC2Arr:        number[] = [];
    const sfSibArr:       number[] = [];
    const sfTotalArr:     number[] = [];
    const leaveYrs:       number[] = [];
    const rentArr:        number[] = [];
    let   person1HelpClearedYr: number | null = null;
    let   person2HelpClearedYr: number | null = null;
    const purchaseYr:     number | null = (rentMode && purchasePlanEnabled) ? targetPurchaseYear : null;

    for (let i = 0; i < projYears; i++) {
      const yr          = cy + i + 1;
      const yearInflRate = inflRateForYear(yr);
      expBase  *= (1 + yearInflRate);
      if (i > 0) pplIndex *= (1 + yearInflRate);
      const pplGross = (parentalLeaveEnabled ? PPL_TOTAL : 0) * pplIndex;
      if (!isRenting) pVal *= (1 + pG);  // only grow property value when owned

      // ── Rent → own transition ──────────────────────────────────────────────
      if (isRenting && purchasePlanEnabled && yr === targetPurchaseYear) {
        isRenting = false;
        // Deduct deposit from savings and investments
        const fromCash   = Math.min(depositFromCash, cash);
        cash             = Math.max(0, cash - fromCash);
        const fromAssets = Math.min(depositFromInvestments, invest);
        // Rough 12% effective CGT haircut (assumes assets held >12 months, ~45% marginal rate)
        const cgtHaircut = fromAssets * 0.12;
        invest           = Math.max(0, invest - fromAssets - cgtHaircut);
        // Start mortgage
        mb               = targetPropertyValue * (1 - depositPct / 100);
        lMortRate        = newMortgageRate / 100;
        lMortPayment     = computeMonthlyRepayment(mb, newMortgageRate, newMortgageTermYrs * 12);
        pVal             = targetPropertyValue * (1 + pG);  // property starts growing from purchase year
        rentAnnual       = 0;
      }

      // ── Income ──
      const phase        = getPhaseForYear(yr, sorted);
      const p1Phase      = getPhaseForYear(yr, sortedPerson1);
      const isLeave      = phase.days === 0;
      const isFirstLeave = isLeave && leaveSt.has(yr);

      // HELP balances are indexed on 1 June; expense inflation stands in for CPI.
      p1HELP *= (1 + yearInflRate);
      p2HELP *= (1 + yearInflRate);

      const p1GrossYr   = p1GrossBase * Math.pow(1 + jG, i + 1);
      const p1DaysGross = p1GrossYr * (p1Phase.days / 5);
      // Compulsory repayment, capped at what's still owed, so the clearing year
      // only deducts the residual.
      const p1Repay     = p1HELP > 0 ? Math.min(p1HELP, calcHELPRepayment(p1DaysGross)) : 0;
      let p1Annual: number;
      if (taxMode) {
        p1Annual = calcAfterTax(p1DaysGross) - p1Repay;
      } else {
        // Simple mode: the entered net pay is taken as already net of HELP.
        p1Annual = person1MonthlyNet * 12 * Math.pow(1 + jG, i + 1) * (p1Phase.days / 5);
      }
      if (p1Repay > 0) {
        p1HELP = Math.max(0, p1HELP - p1Repay);
        if (p1HELP < 1 && person1HelpClearedYr === null) { p1HELP = 0; person1HelpClearedYr = yr; }
      }

      let p2Annual: number;
      if (isLeave) {
        // PPL is paid once per birth (the first leave year) and is taxable.
        p2Annual = isFirstLeave ? calcAfterTax(pplGross) : 0;
        leaveYrs.push(yr);
      } else {
        const p2GrossFTE  = p2GrossBase * Math.pow(1 + gG, i + 1);
        const p2DaysGross = p2GrossFTE * (phase.days / 5);
        const p2Repay     = p2HELP > 0 ? Math.min(p2HELP, calcHELPRepayment(p2DaysGross)) : 0;

        if (taxMode) {
          p2Annual = calcAfterTax(p2DaysGross) - p2Repay;
        } else {
          // Simple mode mirrors Person 1: entered net pay, own growth rate.
          p2Annual = person2MonthlyNet * 12 * Math.pow(1 + gG, i + 1) * (phase.days / 5);
        }

        if (p2Repay > 0) {
          p2HELP = Math.max(0, p2HELP - p2Repay);
          if (p2HELP < 1 && person2HelpClearedYr === null) { p2HELP = 0; person2HelpClearedYr = yr; }
        }
      }
      person1Arr.push(Math.round(p1Annual));
      person2Arr.push(Math.round(p2Annual));

      // ── School fees ──
      const sf = includeSchoolFees
        ? schoolFeesForYear(yr, sfC1Start, sfC1ExitIdx, sfC2Start, sfC2ExitIdx, sfInfl, sfSchedule)
        : { total: 0, c1: 0, c2: 0, sibSaving: 0, cml: 0 };
      sfC1Arr.push(Math.round(sf.c1));
      sfC2Arr.push(Math.round(sf.c2));
      sfSibArr.push(Math.round(sf.sibSaving));
      sfTotalArr.push(Math.round(sf.total));

      // ── Life phase overlay ──
      const phaseOverlay = lifePhaseCostForYear(yr, lifePhases, yearInflRate * 100, cI * 100);

      // ── Monthly cashflow loop (mortgage with live offset) ──
      const annualInc  = p2Annual + p1Annual;
      // Rent is separate from expBase and grows at rentIncreaseRate. Mortgage
      // repayments are NOT in here: simulateMortgageYear pays them out of cash
      // at the actual (un-inflated) amount and stops once the loan is cleared,
      // for the current loan and for one started by a purchase plan alike.
      const nonMortExp  = expBase + sf.total + phaseOverlay + rentAnnual;
      const oneoffTotal = oneoffs.filter(o => o.year === yr).reduce((s, o) => s + o.amt, 0);

      const monthlyNetFlow = (annualInc - nonMortExp) / 12;
      const mortResult = simulateMortgageYear(mb, cash, lMortRate, lMortPayment, monthlyNetFlow);
      mb   = mortResult.endBalance;
      cash = mortResult.endCash;
      const mortPaid   = mortResult.annualPaid;
      const annualExp  = nonMortExp + mortPaid;   // reported expenses include repayments

      // Grow rent for next year (only while renting)
      rentArr.push(Math.round(rentAnnual));
      if (isRenting) rentAnnual *= (1 + rentIncreaseRate / 100);

      // Deduct one-offs (lump sum during the year)
      cash = Math.max(0, cash - oneoffTotal);

      // ── Invest surplus ──
      const surplusThisYear = annualInc - annualExp - oneoffTotal;
      const invested        = Math.max(0, surplusThisYear) * sR;
      cash    = Math.max(0, cash - invested);
      invest  = invest * (1 + iR) + invested;

      const equity = pVal - mb;
      const nw     = equity + cash + invest + crypto - p1HELP - p2HELP - otherDebts;

      phaseArr.push(Math.round(phaseOverlay));
      deficitArr.push(Math.round(annualInc - annualExp));
      cashRunningArr.push(Math.round(cash));

      // Mortgage stress: annual repayments / gross household income (standard AU definition)
      const p1GrossForStress = p1GrossBase * Math.pow(1 + jG, i + 1) * (p1Phase.days / 5);
      const p2GrossForStress = (() => {
        if (isLeave) return isFirstLeave ? pplGross : 0;
        const fte = p2GrossBase * Math.pow(1 + gG, i + 1);
        return fte * (phase.days / 5);
      })();
      const grossHousehold = p1GrossForStress + p2GrossForStress;
      // Repayments actually made: 0 while renting and once the loan is cleared.
      const stressPct = grossHousehold > 0 ? mortPaid / grossHousehold * 100 : 0;
      mortStressArr.push(parseFloat(stressPct.toFixed(1)));

      nwArr.push(Math.round(nw));
      incArr.push(Math.round(annualInc));
      expArr.push(Math.round(annualExp));
      mortArr.push(Math.round(mb));
      cashArr.push(Math.round(cash));
      investArr.push(Math.round(invest));
    }

    return {
      nwArr, incArr, expArr, mortArr, cashArr, investArr,
      person1Arr, person2Arr, phaseArr, deficitArr, cashRunningArr, mortStressArr,
      sfC1Arr, sfC2Arr, sfSibArr, sfTotalArr, leaveYrs, person1HelpClearedYr, person2HelpClearedYr,
      rentArr, purchaseYr,
    };
  }

  const base     = runProjection(false);
  const withFees = schoolFeesOn ? runProjection(true) : null;

  return { base, withFees, labels };
}
