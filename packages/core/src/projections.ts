// 20-year dual simulation (with fees / without fees for comparison)
// Stepped inflation: near-term rate for 2026-28, long-run rate for 2029+
// Childcare phases use separate higher inflation rate (historically ~12%, modelled at 6%)
// Mortgage offset updates EVERY MONTH within the 12-month loop — do not simplify to annual
// Two runs: withFees (if schoolFeesOn) and base (always)

import { calcAfterTax, calcHELPRepayment } from './tax';
import { investIncomeYear, grossFromNet, type InvestIncomeSettings } from './investmentIncome';
import { packageYear, netPay, NO_PACKAGE, type PackagedItemLike } from './packaging';
import { simulateMortgageYear, computeMonthlyRepayment } from './mortgage';
import { schoolFeesYear, LEGACY_FEE_RULES, SF_BASE as SF_DEFAULT, type FeeSchedule, type SchoolKid, type SchoolFeeRules } from './schoolFees';
import { lifePhaseCostForYear } from './lifephases';
import type { LifePhaseOverlay } from './lifephases';
import { PPL_TOTAL, NEAR_TERM_INFLATION_HORIZON } from './constants';
import { superAccumulationYear, superPensionGrowth } from './super';
import { legislativeCap } from './superHistory';
import { PRESERVATION_AGE, minimumDrawdownRate, superAccessible, type DrawdownStrategy } from './retirement';
import { lifeStageYear, LATE_RETIREMENT_AGE, LATE_RETIREMENT_FACTOR, type LifeStageFacts } from './lifeStages';

export interface WorkPhase {
  year: number;
  days: number; // 0 = parental leave, 1-5 = days/week
}

export interface OneOff {
  name: string;
  amt:  number;
  year: number;
}

/**
 * The life course: ages, retirement, super and how retirement is paid for.
 * Super-fund rates are DECIMALS (0.12), as in super.ts; everything else on
 * ProjectionInputs is a percentage.
 */
export interface LifeCourse {
  partnerEnabled:       boolean;
  person1Age:           number;   // age in currentYear
  person2Age:           number;
  person1RetirementAge: number;   // pay stops in the year they reach it
  person2RetirementAge: number;
  person1Super:         number;   // balance today
  person2Super:         number;
  person1ExtraSuper:    number;   // salary sacrifice a year, while working
  person2ExtraSuper:    number;
  sgRate:               number;   // decimal
  superReturn:          number;   // decimal
  superFeePct:          number;   // decimal
  /** Yearly spending once everyone has retired, in today's dollars, excluding rent, the home loan and school fees (the engine models those). */
  retirementSpending:   number;
  drawdown:             DrawdownStrategy;
  drawdownPct:          number;   // percent, for 'percentOfBalance'
}

/**
 * In net-pay mode there's no tax calculation, so salary sacrifice reduces
 * take-home pay by the contribution less the 28% the mode already assumes
 * (gross = net / 0.72, see p1GrossBase).
 */
const NET_MODE_KEEP = 0.72;

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
  /**
   * Months of spending kept as cash before anything is invested or spent on
   * fun (default 0). The year's money out (spending, rent, repayments) sets
   * the month, so the buffer grows with prices.
   */
  cashBufferMonths?:  number;
  /** % of the surplus above the buffer spent on fun / lifestyle (default 0); it leaves net worth. Capped at 100 - savingsRate. */
  funPct?:            number;
  investReturn:       number;
  /**
   * A return for each projected year instead of `investReturn` (percent, by
   * year index), from uncertainty.ts: a glide path, or one Monte Carlo run.
   */
  investReturnByYear?: number[];
  /** Super's return for each projected year instead of `superReturn` (decimal, by year index). */
  superReturnByYear?:  number[];
  /** Skip the without-school-fees run (its `base` is then the with-fees run). For Monte Carlo. */
  mainOnly?:           boolean;
  /**
   * Interest on cash and dividends on investments, taxed (investmentIncome.ts).
   * Without it, cash earns nothing and investments grow untaxed (as before Phase 50).
   */
  investIncome?:       InvestIncomeSettings;
  /** Salary packaging items (packaging.ts): paid from pre-tax pay, in tax mode, while working. */
  packaging?:          PackagedItemLike[];

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
  /**
   * School fees v2: every child's school years and fee tables, eldest first,
   * and the household's fee rules. Without them, the two children above
   * (sfC1Start…) on sfSchedule with the rules before v2.
   */
  schoolKids?:        SchoolKid[];
  sfRules?:           SchoolFeeRules;

  // Life phase overlays (the mutable set from DB or defaults)
  lifePhases:         LifePhaseOverlay[];

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
  /** Stamp duty and buying costs, % of the price, paid upfront (default 0). */
  stampDutyPct?:         number;
  newMortgageRate:       number;  // as percent (e.g. 6.0)
  newMortgageTermYrs:    number;

  // Without a life course, the engine runs as before: pay never stops and
  // super isn't modelled.
  lifeCourse?:           LifeCourse;

  /**
   * Costs that follow ages (lifeStages.ts): children's costs by age and
   * leaving home, childcare ending at school, working costs following work
   * days, and retirement spending easing from 85. Without it, spending only
   * grows with prices, as before.
   */
  lifeStages?:           LifeStageFacts;
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
  /** Change in spending from today's budget because of life stages (in expArr): children growing up and leaving, childcare ending, work costs, late retirement. */
  stageArr:       number[];
  /** Spent on fun / lifestyle out of the surplus above the cash buffer (not in expArr). */
  funArr:         number[];
  /** Investment income each year (zeros without `investIncome`): interest on cash, dividends, tax on both after franking credits (negative: a refund), and what reached cash (interest less tax). */
  interestArr:    number[];
  dividendArr:    number[];
  investTaxArr:   number[];
  investIncArr:   number[];
  /** Extra take-home pay from salary packaging each year (tax saved, less any extra HELP). */
  packagingArr:   number[];
  /** The cash buffer aimed for at the end of each year (0 without one). */
  bufferArr:      number[];
  /** Shortfalls not covered by cash or investments, carried as money owed (in net worth). */
  owedArr:        number[];
  mortStressArr:  number[];
  sfC1Arr:        number[];
  sfC2Arr:        number[];
  sfSibArr:       number[];
  sfTotalArr:     number[];
  /** Each child's fees by year (after sibling discounts, entry fees included), eldest first: sfChildArr[child][year]. */
  sfChildArr:     number[][];
  /** The yearly family fee. */
  sfFamilyArr:    number[];
  leaveYrs:       number[];
  person1HelpClearedYr: number | null;
  person2HelpClearedYr: number | null;
  rentArr:        number[];   // annual rent paid each year (0 for homeowners / post-purchase)
  purchaseYr:     number | null; // year of rent→own transition (null if no purchase plan)
  /** How the purchase was paid for (null without one): see buyHome. */
  purchase:       PurchasePaid | null;

  // ── Life course (zeros / nulls without one) ──
  /** Super balances at the end of each year. Not in nwArr: super is shown separately. */
  super1Arr:      number[];
  super2Arr:      number[];
  superArr:       number[];
  /** Taken out of super each year: to live on (included in incArr) and to clear money owed (not). */
  superDrawArr:   number[];
  /** True in the years everyone has stopped work. */
  retiredArr:     boolean[];
  person1RetireYr: number | null;
  person2RetireYr: number | null;
  /** First year, once everyone has retired, that money runs short (money owed grows). */
  shortfallYr:    number | null;
  /** First year money runs short while someone has retired but can't yet reach their super (the "bridge" years). */
  bridgeShortYr:  number | null;
}

/** How the deposit and buying costs were met in the purchase year. */
export interface PurchasePaid {
  year:            number
  deposit:         number
  duty:            number
  /** Taken from cash: the amount set aside for it first, then any other cash. */
  fromCash:        number
  /** Raised by selling investments (the set-aside amount first, then any others). */
  fromInvestments: number
  /** Capital gains tax on those sales (the ~12% haircut). */
  cgt:             number
  /** What cash and investments couldn't cover, added to the home loan. */
  borrowedExtra:   number
}

/** Rough effective CGT on investments sold (held over 12 months, a high marginal rate). */
export const SALE_CGT_HAIRCUT = 0.12

/**
 * Pays a deposit plus buying costs: first the cash and investments set
 * aside for it, then any other cash, then any other investments. Whatever
 * is still missing is added to the loan, so the money never comes from
 * nowhere. Set-aside amounts beyond what's needed stay where they are.
 */
export function buyHome(p: {
  price: number; depositPct: number; stampDutyPct: number
  setAsideCash: number; setAsideInvestments: number
  cash: number; invest: number
}): Omit<PurchasePaid, 'year'> & { cash: number; invest: number; loan: number } {
  const deposit = p.price * p.depositPct / 100
  const duty    = p.price * p.stampDutyPct / 100
  let need = deposit + duty, cash = p.cash, invest = p.invest, fromCash = 0, fromInvestments = 0
  const takeCash = (limit: number) => { const x = Math.max(0, Math.min(limit, cash, need)); cash -= x; need -= x; fromCash += x }
  const sell     = (limit: number) => {
    const x = Math.max(0, Math.min(limit, invest / (1 + SALE_CGT_HAIRCUT), need))
    invest -= x * (1 + SALE_CGT_HAIRCUT); need -= x; fromInvestments += x
  }
  takeCash(p.setAsideCash); sell(p.setAsideInvestments)
  takeCash(Infinity);       sell(Infinity)
  return {
    deposit, duty, fromCash, fromInvestments, cgt: fromInvestments * SALE_CGT_HAIRCUT, borrowedExtra: need,
    cash, invest: Math.max(0, invest), loan: p.price - deposit + need,
  }
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
    propGrowth, savingsRate, investReturn, investReturnByYear, superReturnByYear,
    projYears,
    mortBalance, mortRate, mortPayment, cashOnHand, propValue, cryptoValue,
    person1Phases, person2Phases, baseMonthlyExpenses, oneoffs,
    parentalLeaveEnabled,
    schoolFeesOn, sfC1Start, sfC1ExitIdx, sfC2Start, sfC2ExitIdx, sfInfl, sfSchedule,
    schoolKids, sfRules,
    lifePhases, currentYear,
    rentMode, monthlyRent, rentIncreaseRate,
    purchasePlanEnabled, targetPurchaseYear, targetPropertyValue, depositPct,
    depositFromCash, depositFromInvestments, newMortgageRate, newMortgageTermYrs, stampDutyPct,
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
  const sR     = Math.min(1, Math.max(0, savingsRate / 100));
  const fR     = Math.min(1 - sR, Math.max(0, (inputs.funPct ?? 0) / 100));
  const bufMonths = Math.max(0, inputs.cashBufferMonths ?? 0);
  const iR     = investReturn / 100;
  const mRate  = mortRate     / 100;

  function inflRateForYear(yr: number): number {
    return yr <= NEAR_TERM_INFLATION_HORIZON ? eINear : eI;
  }

  // Gross base salaries for projection
  const p1GrossBase = taxMode ? person1FTE : person1MonthlyNet * 12 / 0.72;
  const p2GrossBase = taxMode ? person2FTE  : person2MonthlyNet * 12 / 0.72;

  const legacySchedule = sfSchedule ?? SF_DEFAULT;
  const legacyKid = (start: number, exitIdx: number): SchoolKid =>
    ({ start, exitIdx, primary: legacySchedule, secondary: legacySchedule, primaryChoice: 'custom', secondaryChoice: 'custom' });
  const kids: SchoolKid[] = schoolKids ?? [legacyKid(sfC1Start, sfC1ExitIdx), legacyKid(sfC2Start, sfC2ExitIdx)];
  const rules = sfRules ?? LEGACY_FEE_RULES;

  function runProjection(includeSchoolFees: boolean): ProjectionResult {
    let expBase   = baseMonthlyExpenses * 12;
    let mb        = rentMode ? 0 : mortBalance;
    let pVal      = rentMode ? 0 : propValue;
    let cash      = cashOnHand;
    let invest    = Math.max(0, inputs.investmentsValue ?? 0);
    // Spending that cash and investments couldn't cover: carried as money
    // owed (a redraw, a card) until later surpluses repay it.
    let owed      = 0;
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

    // Life course state
    const lc       = inputs.lifeCourse;
    let s1         = lc ? Math.max(0, lc.person1Super) : 0;
    let s2         = lc && lc.partnerEnabled ? Math.max(0, lc.person2Super) : 0;
    let retSpend   = lc ? Math.max(0, lc.retirementSpending) : 0;
    // The 4% rule's yearly amount per person: set in their first pension year, then grown with inflation.
    const fourPct: [number | null, number | null] = [null, null];

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
    const funArr:         number[] = [];
    const interestArr:    number[] = [];
    const dividendArr:    number[] = [];
    const investTaxArr:   number[] = [];
    const investIncArr:   number[] = [];
    const packagingArr:   number[] = [];
    const stageArr:       number[] = [];
    // Prices relative to today, for amounts given in today's dollars.
    let priceIdx  = 1;
    const bufferArr:      number[] = [];
    const owedArr:        number[] = [];
    const mortStressArr:  number[] = [];
    const sfC1Arr:        number[] = [];
    const sfC2Arr:        number[] = [];
    const sfSibArr:       number[] = [];
    const sfTotalArr:     number[] = [];
    const sfChildArr:     number[][] = kids.map(() => []);
    const sfFamilyArr:    number[] = [];
    const leaveYrs:       number[] = [];
    const rentArr:        number[] = [];
    const super1Arr:      number[] = [];
    const super2Arr:      number[] = [];
    const superArr:       number[] = [];
    const superDrawArr:   number[] = [];
    const retiredArr:     boolean[] = [];
    let   person1HelpClearedYr: number | null = null;
    let   person2HelpClearedYr: number | null = null;
    let   shortfallYr:    number | null = null;
    let   bridgeShortYr:  number | null = null;
    const purchaseYr:     number | null = (rentMode && purchasePlanEnabled) ? targetPurchaseYear : null;
    let purchase:         PurchasePaid | null = null;

    for (let i = 0; i < projYears; i++) {
      const yr          = cy + i + 1;
      const yearInflRate = inflRateForYear(yr);
      expBase  *= (1 + yearInflRate);
      retSpend *= (1 + yearInflRate);
      priceIdx *= (1 + yearInflRate);
      if (i > 0) pplIndex *= (1 + yearInflRate);
      const pplGross = (parentalLeaveEnabled ? PPL_TOTAL : 0) * pplIndex;
      if (!isRenting) pVal *= (1 + pG);  // only grow property value when owned

      // ── Who's working ── (ages as reached during this year)
      const age1       = lc ? lc.person1Age + i + 1 : 0;
      const age2       = lc ? lc.person2Age + i + 1 : 0;
      const p1Retired  = !!lc && age1 >= lc.person1RetirementAge;
      // No partner: person 2 counts as retired (no pay, no super).
      const p2Retired  = !!lc && (!lc.partnerEnabled || age2 >= lc.person2RetirementAge);
      const allRetired = p1Retired && p2Retired;

      // ── Rent → own transition ──────────────────────────────────────────────
      if (isRenting && purchasePlanEnabled && yr === targetPurchaseYear) {
        isRenting = false;
        const paid = buyHome({
          price: targetPropertyValue, depositPct, stampDutyPct: stampDutyPct ?? 0,
          setAsideCash: depositFromCash, setAsideInvestments: depositFromInvestments, cash, invest,
        });
        cash             = paid.cash;
        invest           = paid.invest;
        purchase         = { year: yr, deposit: paid.deposit, duty: paid.duty, fromCash: paid.fromCash,
          fromInvestments: paid.fromInvestments, cgt: paid.cgt, borrowedExtra: paid.borrowedExtra };
        // Start mortgage
        mb               = paid.loan;
        lMortRate        = newMortgageRate / 100;
        lMortPayment     = computeMonthlyRepayment(mb, newMortgageRate, newMortgageTermYrs * 12);
        pVal             = targetPropertyValue * (1 + pG);  // property starts growing from purchase year
        rentAnnual       = 0;
      }

      // ── Income ──
      const phase        = getPhaseForYear(yr, sorted);
      const p1Phase      = getPhaseForYear(yr, sortedPerson1);
      const isLeave      = !p2Retired && phase.days === 0;
      const isFirstLeave = isLeave && leaveSt.has(yr);

      // HELP balances are indexed on 1 June; expense inflation stands in for CPI.
      p1HELP *= (1 + yearInflRate);
      p2HELP *= (1 + yearInflRate);

      // Salary sacrifice comes out of pre-tax pay. HELP repayment income
      // still counts it (reportable super contributions), so HELP uses gross.
      const p1Days      = p1Retired ? 0 : p1Phase.days;
      const p1GrossYr   = p1GrossBase * Math.pow(1 + jG, i + 1);
      const p1DaysGross = p1GrossYr * (p1Days / 5);
      const p1Sacrifice = lc && p1Days > 0 ? Math.min(Math.max(0, lc.person1ExtraSuper), p1DaysGross) : 0;
      // Compulsory repayment, capped at what's still owed, so the clearing year
      // only deducts the residual.
      // Salary packaging: paid from pre-tax pay; its reportable amount counts for HELP.
      const pk1         = inputs.packaging && taxMode && p1Days > 0 ? packageYear(inputs.packaging, 'p1', yr) : NO_PACKAGE;
      const p1Repay     = p1HELP > 0 ? Math.min(p1HELP, calcHELPRepayment(p1DaysGross + pk1.reportable)) : 0;
      let p1Annual: number;
      let packSaved = 0;
      if (taxMode) {
        p1Annual = netPay(p1DaysGross, p1Sacrifice, false, pk1) - p1Repay;
        if (pk1.pretax > 0) {
          packSaved += p1Annual - (calcAfterTax(p1DaysGross - p1Sacrifice) - (p1HELP > 0 ? Math.min(p1HELP, calcHELPRepayment(p1DaysGross)) : 0));
        }
      } else {
        // Simple mode: the entered net pay is taken as already net of HELP.
        p1Annual = person1MonthlyNet * 12 * Math.pow(1 + jG, i + 1) * (p1Days / 5) - p1Sacrifice * NET_MODE_KEEP;
      }
      if (p1Repay > 0) {
        p1HELP = Math.max(0, p1HELP - p1Repay);
        if (p1HELP < 1 && person1HelpClearedYr === null) { p1HELP = 0; person1HelpClearedYr = yr; }
      }

      const p2DaysGross = p2Retired || isLeave ? 0 : p2GrossBase * Math.pow(1 + gG, i + 1) * (phase.days / 5);
      const p2Sacrifice = lc && p2DaysGross > 0 ? Math.min(Math.max(0, lc.person2ExtraSuper), p2DaysGross) : 0;
      let p2Annual: number;
      let pk2Pretax = 0;
      if (p2Retired) {
        p2Annual = 0;
      } else if (isLeave) {
        // PPL is paid once per birth (the first leave year) and is taxable.
        p2Annual = isFirstLeave ? calcAfterTax(pplGross) : 0;
        leaveYrs.push(yr);
      } else {
        const pk2         = inputs.packaging && taxMode && p2DaysGross > 0 ? packageYear(inputs.packaging, 'p2', yr) : NO_PACKAGE;
        pk2Pretax         = Math.min(pk2.pretax, Math.max(0, p2DaysGross - p2Sacrifice));
        const p2Repay     = p2HELP > 0 ? Math.min(p2HELP, calcHELPRepayment(p2DaysGross + pk2.reportable)) : 0;

        if (taxMode) {
          p2Annual = netPay(p2DaysGross, p2Sacrifice, false, pk2) - p2Repay;
          if (pk2.pretax > 0) {
            packSaved += p2Annual - (calcAfterTax(p2DaysGross - p2Sacrifice) - (p2HELP > 0 ? Math.min(p2HELP, calcHELPRepayment(p2DaysGross)) : 0));
          }
        } else {
          // Simple mode mirrors Person 1: entered net pay, own growth rate.
          p2Annual = person2MonthlyNet * 12 * Math.pow(1 + gG, i + 1) * (phase.days / 5) - p2Sacrifice * NET_MODE_KEEP;
        }

        if (p2Repay > 0) {
          p2HELP = Math.max(0, p2HELP - p2Repay);
          if (p2HELP < 1 && person2HelpClearedYr === null) { p2HELP = 0; person2HelpClearedYr = yr; }
        }
      }
      person1Arr.push(Math.round(p1Annual));
      person2Arr.push(Math.round(p2Annual));

      // ── Super ──
      // Accumulation while working (or retired before preservation age);
      // pension phase once retired and 60+, when earnings are untaxed and
      // at least the legal minimum must be paid out.
      let superDraw = 0;
      if (lc) {
        const cap = legislativeCap(yr + 1);   // the financial year starting this July
        const superRet = superReturnByYear?.[i] ?? lc.superReturn;
        const step = (k: 0 | 1, bal: number, age: number, retired: boolean, sgPay: number, sacrifice: number): number => {
          if (!(retired && age >= PRESERVATION_AGE)) {
            return superAccumulationYear(bal, {
              investmentReturn: superRet, fundFeePercent: lc.superFeePct,
              grossContribution: sgPay * lc.sgRate + sacrifice, cap, salary: sgPay,
            }).balance;
          }
          const grown   = superPensionGrowth(bal, superRet, lc.superFeePct);
          const minimum = minimumDrawdownRate(age) * bal;
          let set = minimum;
          if (lc.drawdown === 'fourPercent') {
            fourPct[k] = fourPct[k] === null ? 0.04 * bal : fourPct[k]! * (1 + yearInflRate);
            set = Math.max(minimum, fourPct[k]!);
          } else if (lc.drawdown === 'percentOfBalance') {
            set = Math.max(minimum, lc.drawdownPct / 100 * bal);
          }
          const paid = Math.min(set, grown);
          superDraw += paid;
          return grown - paid;
        };
        // Super is paid on Paid Parental Leave from 1 July 2025, at the SG
        // rate (Paid Parental Leave Amendment (Adding Superannuation for a
        // More Secure Retirement) Act 2024).
        const p2SgPay = isLeave ? (isFirstLeave ? pplGross : 0) : p2DaysGross;
        s1 = step(0, s1, age1, p1Retired, p1DaysGross, p1Sacrifice);
        if (lc.partnerEnabled) s2 = step(1, s2, age2, p2Retired, p2SgPay, p2Sacrifice);
      }

      // ── School fees ──
      const sf = includeSchoolFees
        ? schoolFeesYear(yr, kids, rules, sfInfl)
        : { total: 0, perChild: kids.map(() => 0), sibSaving: 0, family: 0 };
      sfC1Arr.push(Math.round(sf.perChild[0] ?? 0));
      sfC2Arr.push(Math.round(sf.perChild[1] ?? 0));
      sfSibArr.push(Math.round(sf.sibSaving));
      sfTotalArr.push(Math.round(sf.total));
      sf.perChild.forEach((v, i) => sfChildArr[i].push(Math.round(v)));
      sfFamilyArr.push(Math.round(sf.family));

      // ── Investment income ── on start-of-year balances, taxed on top of
      // each person's other taxable income (investmentIncome.ts).
      let investCash = 0;
      if (inputs.investIncome) {
        const p1Taxable = p1Retired ? 0 : taxMode ? Math.max(0, p1DaysGross - p1Sacrifice - pk1.pretax) : grossFromNet(p1Annual);
        const p2Taxable = p2Retired ? 0 : isLeave ? (isFirstLeave ? pplGross : 0)
          : taxMode ? Math.max(0, p2DaysGross - p2Sacrifice - pk2Pretax) : grossFromNet(p2Annual);
        const partner = lc ? lc.partnerEnabled : (person2FTE > 0 || person2MonthlyNet > 0);
        const yi = investIncomeYear(inputs.investIncome, { cash, loan: mb, invest }, [p1Taxable, p2Taxable], partner);
        investCash = yi.cash;
        interestArr.push(Math.round(yi.interest)); dividendArr.push(Math.round(yi.dividends));
        investTaxArr.push(Math.round(yi.tax));     investIncArr.push(Math.round(yi.cash));
      } else {
        interestArr.push(0); dividendArr.push(0); investTaxArr.push(0); investIncArr.push(0);
      }

      packagingArr.push(Math.round(packSaved));

      // ── Life phase overlay ──
      const phaseOverlay = lifePhaseCostForYear(yr, lifePhases, yearInflRate * 100, cI * 100);

      // ── Monthly cashflow loop (mortgage with live offset) ──
      const annualInc  = p2Annual + p1Annual + investCash;
      // Rent is separate from expBase and grows at rentIncreaseRate. Mortgage
      // repayments are NOT in here: simulateMortgageYear pays them out of cash
      // at the actual (un-inflated) amount and stops once the loan is cleared,
      // for the current loan and for one started by a purchase plan alike.
      // Once everyone has retired, everyday spending becomes the retirement goal.
      let stageCost = 0;
      const ls = inputs.lifeStages;
      if (ls) {
        const days1 = p1Retired ? 0 : p1Phase.days;
        const days2 = p2Retired || isLeave ? 0 : phase.days;
        const st = lifeStageYear(ls, { currentYear: cy, year: yr, workDays: [days1, days2], allRetired });
        stageCost = (st.children + st.childcare + st.work) * priceIdx;
        // From 85 (the younger adult), retirement spending eases (ASFA).
        const younger = lc ? (lc.partnerEnabled ? Math.min(age1, age2) : age1) : 0;
        if (allRetired && lc && younger >= LATE_RETIREMENT_AGE) {
          stageCost += retSpend * ((lc.partnerEnabled ? LATE_RETIREMENT_FACTOR.couple : LATE_RETIREMENT_FACTOR.single) - 1);
        }
      }
      const nonMortExp  = Math.max(0, (allRetired ? retSpend : expBase) + stageCost) + sf.total + phaseOverlay + rentAnnual;
      const oneoffTotal = oneoffs.filter(o => o.year === yr).reduce((s, o) => s + o.amt, 0);

      const monthlyNetFlow = (annualInc + superDraw - nonMortExp) / 12;
      const mortResult = simulateMortgageYear(mb, cash, lMortRate, lMortPayment, monthlyNetFlow);
      mb   = mortResult.endBalance;
      cash = mortResult.endCash;
      const mortPaid   = mortResult.annualPaid;
      const annualExp  = nonMortExp + mortPaid;   // reported expenses include repayments

      // Grow rent for next year (only while renting)
      rentArr.push(Math.round(rentAnnual));
      if (isRenting) rentAnnual *= (1 + rentIncreaseRate / 100);

      // ── Shortfalls ──
      // Months cash couldn't cover, and one-offs beyond the cash left, come
      // out of investments first, then (spending what you need) from super
      // that can be reached; anything more is carried as money owed.
      // (Flooring cash at 0 alone would make a shortfall simply vanish.)
      const fromCash = Math.min(cash, oneoffTotal);
      cash -= fromCash;
      const gap        = mortResult.unfunded + (oneoffTotal - fromCash);
      const fromInvest = Math.min(invest, gap);
      invest -= fromInvest;
      let short = gap - fromInvest;
      // Spending what you need also clears money owed (e.g. from the years
      // before super could be reached) once super can be reached.
      let superRepay = 0;
      if (lc && lc.drawdown === 'need' && short + owed > 0.5) {
        const r1 = superAccessible(age1, p1Retired) ? s1 : 0;
        const r2 = lc.partnerEnabled && superAccessible(age2, p2Retired) ? s2 : 0;
        const take = Math.min(short + owed, r1 + r2);
        if (take > 0) {
          s1 -= take * r1 / (r1 + r2);
          s2 -= take * r2 / (r1 + r2);
          const toShort = Math.min(short, take);
          short     -= toShort;
          superDraw += toShort;
          superRepay = take - toShort;
          owed      -= superRepay;
        }
      }
      owed += short;
      if (short > 0.5 && lc) {
        const locked = (p1Retired && !superAccessible(age1, true))
          || (lc.partnerEnabled && p2Retired && !superAccessible(age2, true));
        if (locked) bridgeShortYr ??= yr;
        else if (allRetired) shortfallYr ??= yr;
      }

      // ── Invest surplus ── (after repaying anything owed)
      // With a cash buffer, the surplus first tops cash up to the buffer;
      // only what's above it is split between investing, fun and cash kept.
      // Without one, the whole surplus is split, as before.
      const repaid          = Math.min(owed, cash);
      owed -= repaid;
      cash -= repaid;
      const moneyIn         = annualInc + superDraw;
      const surplusThisYear = moneyIn - annualExp - oneoffTotal;
      const buffer          = bufMonths * annualExp / 12;
      const available       = Math.max(0, surplusThisYear - repaid);
      const splittable      = bufMonths > 0 ? Math.min(available, Math.max(0, cash - buffer)) : available;
      const invested        = splittable * sR;
      const fun             = splittable * fR;
      cash    = Math.max(0, cash - invested - fun);
      const yearReturn = investReturnByYear?.[i] != null ? investReturnByYear[i] / 100 : iR;
      invest  = invest * (1 + yearReturn) + invested;

      const equity = pVal - mb;
      const nw     = equity + cash + invest + crypto - p1HELP - p2HELP - otherDebts - owed;

      phaseArr.push(Math.round(phaseOverlay));
      deficitArr.push(Math.round(moneyIn - annualExp));
      cashRunningArr.push(Math.round(cash));
      funArr.push(Math.round(fun));
      stageArr.push(Math.round(stageCost));
      bufferArr.push(Math.round(buffer));
      owedArr.push(Math.round(owed));

      // Mortgage stress: annual repayments / gross household income (standard AU definition)
      const p2GrossForStress = isLeave ? (isFirstLeave ? pplGross : 0) : p2DaysGross;
      const grossHousehold = p1DaysGross + p2GrossForStress;
      // Repayments actually made: 0 while renting and once the loan is cleared.
      const stressPct = grossHousehold > 0 ? mortPaid / grossHousehold * 100 : 0;
      mortStressArr.push(parseFloat(stressPct.toFixed(1)));

      nwArr.push(Math.round(nw));
      incArr.push(Math.round(moneyIn));
      expArr.push(Math.round(annualExp));
      mortArr.push(Math.round(mb));
      cashArr.push(Math.round(cash));
      investArr.push(Math.round(invest));
      super1Arr.push(Math.round(s1));
      super2Arr.push(Math.round(s2));
      superArr.push(Math.round(s1 + s2));
      superDrawArr.push(Math.round(superDraw + superRepay));
      retiredArr.push(allRetired);
    }

    return {
      nwArr, incArr, expArr, mortArr, cashArr, investArr,
      person1Arr, person2Arr, phaseArr, deficitArr, cashRunningArr, funArr, interestArr, dividendArr, investTaxArr, investIncArr, packagingArr, bufferArr, stageArr, owedArr, mortStressArr,
      sfC1Arr, sfC2Arr, sfSibArr, sfTotalArr, sfChildArr, sfFamilyArr, leaveYrs, person1HelpClearedYr, person2HelpClearedYr,
      rentArr, purchaseYr, purchase,
      super1Arr, super2Arr, superArr, superDrawArr, retiredArr,
      person1RetireYr: lc ? cy + lc.person1RetirementAge - lc.person1Age : null,
      person2RetireYr: lc && lc.partnerEnabled ? cy + lc.person2RetirementAge - lc.person2Age : null,
      shortfallYr, bridgeShortYr,
    };
  }

  const withFees = schoolFeesOn ? runProjection(true) : null;
  // Monte Carlo only needs the run that counts, so it skips the other.
  const base     = inputs.mainOnly && withFees ? withFees : runProjection(false);

  return { base, withFees, labels };
}
