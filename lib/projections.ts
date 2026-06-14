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
import { GRACE_FTE, PPL_MONTHLY, PPL_MONTHS } from './constants';

export interface GracePhase {
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
  jorgeFTE:           number;   // gross annual
  graceFTE:           number;   // gross annual FTE
  taxMode:            boolean;
  graceHasHELP:       boolean;
  graceHELPBalance:   number;   // current HELP balance (for cleared-year tracking)
  jorgeMonthlyNet:    number;   // used in simple (non-tax) mode only
  graceMonthlyNet:    number;   // used in simple (non-tax) mode only

  // Growth & inflation — all as percent (e.g. 3.5 not 0.035)
  jorgeGrowthRate:    number;
  graceGrowthRate:    number;
  expInflNear:        number;   // near-term expense inflation 2026–2028
  expInfl:            number;   // long-run expense inflation 2029+
  childcareInfl:      number;
  propGrowth:         number;
  savingsRate:        number;   // % of annual surplus to invest
  investReturn:       number;

  projYears:          number;

  // Current balances
  mortBalance:        number;
  mortRate:           number;   // as percent (e.g. 5.99)
  mortPayment:        number;   // monthly repayment
  cashOnHand:         number;
  propValue:          number;   // house value (mortgage balance + equity)
  cryptoValue:        number;
  helpDebt:           number;   // total HELP for net-worth debt tracking (crude $10k/yr reduction)

  // Work schedule phases — both persons
  jorgePhases:        GracePhase[];
  gracePhases:        GracePhase[];

  // Expense base (monthly total — already includes mortgage repayment as a line item)
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
  helpClearedYr:  number | null;
  rentArr:        number[];   // annual rent paid each year (0 for homeowners / post-purchase)
  purchaseYr:     number | null; // year of rent→own transition (null if no purchase plan)
}

export interface ProjectionOutput {
  base:      ProjectionResult;
  withFees:  ProjectionResult | null;
  labels:    string[];           // calendar year strings e.g. ['2027', '2028', ...]
}

function getSortedPhases(phases: GracePhase[]): GracePhase[] {
  return [...phases].sort((a, b) => a.year - b.year);
}

function getPhaseForYear(yr: number, sortedPhases: GracePhase[]): GracePhase {
  let p = sortedPhases[0];
  for (const x of sortedPhases) {
    if (x.year <= yr) p = x;
  }
  return p;
}

function daysToAnnual(days: number): number {
  return days === 0 ? 0 : GRACE_FTE * (days / 5);
}

export function runProjections(inputs: ProjectionInputs): ProjectionOutput {
  const {
    jorgeFTE, graceFTE, taxMode, graceHasHELP,
    jorgeMonthlyNet, graceMonthlyNet,
    jorgeGrowthRate, graceGrowthRate,
    expInflNear, expInfl, childcareInfl,
    propGrowth, savingsRate, investReturn,
    projYears,
    mortBalance, mortRate, mortPayment, cashOnHand, propValue, cryptoValue, helpDebt,
    jorgePhases, gracePhases, baseMonthlyExpenses, oneoffs,
    parentalLeaveEnabled,
    schoolFeesOn, sfC1Start, sfC1ExitIdx, sfC2Start, sfC2ExitIdx, sfInfl, sfSchedule,
    lifePhases, currentYear,
    rentMode, monthlyRent, rentIncreaseRate,
    purchasePlanEnabled, targetPurchaseYear, targetPropertyValue, depositPct,
    depositFromCash, depositFromInvestments, newMortgageRate, newMortgageTermYrs,
  } = inputs;

  const cy          = currentYear;
  const labels      = Array.from({ length: projYears }, (_, i) => String(cy + i + 1));
  const sorted      = getSortedPhases(gracePhases);
  const sortedPerson1 = getSortedPhases(jorgePhases.length > 0 ? jorgePhases : [{ year: cy, days: 5 }]);
  const leaveSt     = new Set(sorted.filter(p => p.days === 0).map(p => p.year));

  const jG  = jorgeGrowthRate  / 100;
  const gG  = graceGrowthRate  / 100;
  const eINear = expInflNear  / 100;
  const eI     = expInfl      / 100;
  const cI     = childcareInfl / 100;
  const pG     = propGrowth   / 100;
  const sR     = savingsRate  / 100;
  const iR     = investReturn / 100;
  const mRate  = mortRate     / 100;

  function inflRateForYear(yr: number): number {
    return yr <= 2028 ? eINear : eI;
  }

  // Gross base salaries for projection
  const jorgeGrossBase = taxMode ? jorgeFTE : jorgeMonthlyNet * 12 / 0.72;
  const graceGrossBase = taxMode ? graceFTE  : graceMonthlyNet * 12 / 0.72;

  function runProjection(includeSchoolFees: boolean): ProjectionResult {
    let expBase   = baseMonthlyExpenses * 12;
    let mb        = rentMode ? 0 : mortBalance;
    let pVal      = rentMode ? 0 : propValue;
    let cash      = cashOnHand;
    let invest    = 0;
    let hDebt     = helpDebt;
    let crypto    = cryptoValue;
    let graceHELP = graceHasHELP ? inputs.graceHELPBalance : 0;

    // Renter state — tracked locally so we can mutate through the year loop
    let isRenting      = rentMode;
    let rentAnnual     = monthlyRent * 12;
    let lMortRate      = rentMode ? 0 : mRate;   // local (may change at purchase year)
    let lMortPayment   = rentMode ? 0 : mortPayment;
    let extraAnnualExp = 0;   // mortgage payment added at purchase year (not in expBase)

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
    let   helpClearedYr:  number | null = null;
    const purchaseYr:     number | null = (rentMode && purchasePlanEnabled) ? targetPurchaseYear : null;

    for (let i = 0; i < projYears; i++) {
      const yr          = cy + i + 1;
      const yearInflRate = inflRateForYear(yr);
      expBase  *= (1 + yearInflRate);
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
        extraAnnualExp   = lMortPayment * 12;  // separate from expBase (which has no mortgage for renters)
        pVal             = targetPropertyValue * (1 + pG);  // property starts growing from purchase year
        rentAnnual       = 0;
      }

      // ── Income ──
      const phase        = getPhaseForYear(yr, sorted);
      const jorgePhase   = getPhaseForYear(yr, sortedPerson1);
      const isLeave      = phase.days === 0;
      const isFirstLeave = isLeave && leaveSt.has(yr);

      const jorgeGrossYr  = jorgeGrossBase * Math.pow(1 + jG, i + 1);
      const jorgeDaysGross = jorgeGrossYr * (jorgePhase.days / 5);
      let jorgeAnnual: number;
      if (taxMode) {
        jorgeAnnual = calcAfterTax(jorgeDaysGross);
      } else {
        jorgeAnnual = jorgeMonthlyNet * 12 * Math.pow(1 + jG, i + 1) * (jorgePhase.days / 5);
      }

      let graceAnnual: number;
      if (isLeave) {
        graceAnnual = (parentalLeaveEnabled && isFirstLeave) ? PPL_MONTHLY * PPL_MONTHS : 0;
        leaveYrs.push(yr);
      } else {
        const graceGrossFTE  = graceGrossBase * Math.pow(1 + gG, i + 1);
        const graceDaysGross = graceGrossFTE * (phase.days / 5);
        const helpActive     = graceHasHELP && graceHELP > 0;

        if (taxMode) {
          graceAnnual = calcAfterTax(graceDaysGross, helpActive);
        } else {
          graceAnnual = daysToAnnual(phase.days) * Math.pow(1 + jG * 0.5, i);
        }

        if (helpActive) {
          const repay = Math.min(graceHELP, calcHELPRepayment(graceDaysGross));
          graceHELP   = Math.max(0, graceHELP - repay);
          if (graceHELP === 0 && !helpClearedYr) helpClearedYr = yr;
        }
      }
      person1Arr.push(Math.round(jorgeAnnual));
      person2Arr.push(Math.round(graceAnnual));

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
      const annualInc  = graceAnnual + jorgeAnnual;
      // For renters: rent is separate (not in expBase) and grows at rentIncreaseRate.
      // For post-purchase: extraAnnualExp holds the new mortgage payment (also separate).
      const annualExp  = expBase + sf.total + phaseOverlay + rentAnnual + extraAnnualExp;
      const oneoffTotal = oneoffs.filter(o => o.year === yr).reduce((s, o) => s + o.amt, 0);

      // For renters (no mortgage): simulateMortgageYear with mb=0/payment=0 just accumulates cash.
      // For post-purchase: uses the new mortgage parameters set at transition year.
      const monthlyNetFlow = (annualInc - annualExp) / 12;
      const mortResult = simulateMortgageYear(mb, cash, lMortRate, lMortPayment, monthlyNetFlow);
      mb   = mortResult.endBalance;
      cash = mortResult.endCash;

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

      // Crude HELP debt reduction for net-worth calculation (not the repayment model above)
      hDebt = Math.max(0, hDebt - Math.min(10000, hDebt));

      const equity = pVal - mb;
      const nw     = equity + cash + invest + crypto - hDebt;

      phaseArr.push(Math.round(phaseOverlay));
      deficitArr.push(Math.round(annualInc - annualExp));
      cashRunningArr.push(Math.round(cash));

      // Mortgage stress: annual repayments / gross household income (standard AU definition)
      const jorgeGrossForStress = jorgeGrossBase * Math.pow(1 + jG, i + 1) * (jorgePhase.days / 5);
      const graceGrossForStress = (() => {
        if (isLeave) return (parentalLeaveEnabled && isFirstLeave) ? PPL_MONTHLY * PPL_MONTHS : 0;
        const fte = graceGrossBase * Math.pow(1 + gG, i + 1);
        return fte * (phase.days / 5);
      })();
      const grossHousehold = jorgeGrossForStress + graceGrossForStress;
      // For renters pre-purchase, lMortPayment=0 → stress=0 (correct). Post-purchase uses new payment.
      const stressPct = grossHousehold > 0 ? (lMortPayment * 12) / grossHousehold * 100 : 0;
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
      sfC1Arr, sfC2Arr, sfSibArr, sfTotalArr, leaveYrs, helpClearedYr,
      rentArr, purchaseYr,
    };
  }

  const base     = runProjection(false);
  const withFees = schoolFeesOn ? runProjection(true) : null;

  return { base, withFees, labels };
}
