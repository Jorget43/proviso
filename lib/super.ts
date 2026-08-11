import { legislativeCap, currentFinancialYearEnding } from './superHistory'

// Canonical home for the Div 293 threshold (tracked by lib/watchdog.ts). Other
// modules (e.g. lib/eofy.ts) import this rather than re-declaring it.
export const DIV293_THRESHOLD = 250_000

export interface SuperInputs {
  currentBalance:          number
  currentAge:              number
  retirementAge:           number
  salaryExcSuper:          number
  sgRate:                  number
  investmentReturn:        number
  additionalContribs:      number
  fundFeePercent:          number
  inflationRate:           number
  salaryGrowthRate:        number
  desiredRetirementIncome: number
  // Run-start calendar year, for SuperRow.year. Genuinely "now" — unlike
  // MODEL_BASE_YEAR (lib/constants.ts), this must be injected per-call, not
  // hardcoded. Defaults to the wall clock when omitted so existing callers
  // (there is exactly one: lib/super.ts's own runHouseholdProjection) are
  // unaffected.
  startYear?:              number
  // Run-start financial-year-ending (e.g. 2027 for FY2026-27), used for the
  // concessional cap lookup — see lib/superHistory.ts's legislativeCap.
  // Distinct from startYear: FY-ending and calendar year are frequently NOT
  // the same number for "now" (e.g. August 2026 is calendar year 2026 but
  // FY-ending 2027). Defaults to currentFinancialYearEnding() when omitted.
  startFyEnding?:          number
  // First-year concessional cap top-up from carry-forward headroom (unused
  // cap from the last 5 FYs, when eligible — see computeCarryForward in
  // lib/superHistory.ts). Applied only in the run's first accumulation year;
  // 0/omitted preserves prior behaviour.
  firstYearCapBonus?:      number
}

export interface SuperRow {
  count:           number
  age:             number
  year:            number
  phase:           'accumulation' | 'drawdown'
  balance:         number
  earnings:        number
  earningsTax:     number
  contribution:    number
  contributionTax: number
  fees:            number
  drawdown:        number
  salary:          number
  presentValue:    number
  capHit:          boolean
  div293:          boolean
  // Financial-year-ending this row's concessional cap was looked up against
  // — see SuperInputs.startFyEnding. Always populated (accumulation and
  // drawdown), even though only accumulation rows use it for the cap.
  fyEnding:        number
}

export interface SuperResult {
  rows:                SuperRow[]
  retirementBalance:   number
  retirementBalancePV: number
  monthlyIncomeToday:  number
  depletionAge:        number | null
  yearsOfIncome:       number | null
}

// ── Household (two-person) types ──────────────────────────────────────────────

export interface HouseholdSuperInputs {
  // Shared fund assumptions
  sgRate:                   number
  investmentReturn:         number
  fundFeePercent:           number
  inflationRate:            number
  desiredRetirementIncome:  number  // household combined annual goal (today's $)

  // Person 1
  person1Balance:             number
  person1RetirementAge:       number
  person1AdditionalContribs:  number

  // Person 2 (partner)
  partnerEnabled:             boolean
  person2Balance:             number
  person2RetirementAge:       number
  person2AdditionalContribs:  number

  // Concessional cap carry-forward headroom (unused cap from the last 5 FYs,
  // usable only when TSB-eligible — see computeCarryForward in
  // lib/superHistory.ts). Applied to each person's first projection year
  // only. 0/omitted preserves prior behaviour (no carry-forward applied).
  person1CapCarryForward?:    number
  person2CapCarryForward?:    number
}

export interface ProjectionContext {
  person1Age:          number
  person1Salary:       number
  person1SalaryGrowth: number  // decimal e.g. 0.035
  person2Age:          number
  person2Salary:       number
  person2SalaryGrowth: number
  // Run-start calendar year — see SuperInputs.startYear. Threaded through to
  // both persons' SuperInputs so they share one run-start rather than each
  // independently defaulting to the wall clock.
  startYear?:          number
  // Run-start financial-year-ending — see SuperInputs.startFyEnding.
  startFyEnding?:      number
}

export interface CombinedRow {
  year:           number
  person1Age:     number
  person2Age:     number
  person1Balance: number
  person2Balance: number
  total:          number
  totalPV:        number
}

export interface HouseholdSuperResult {
  person1:                   SuperResult
  person2:                   SuperResult | null
  combined:                  CombinedRow[]
  combinedDepletionAge:      number | null   // person 1's age when combined pool depletes
  combinedRetirementTotal:   number
  combinedRetirementTotalPV: number
  monthlyIncomeGoal:         number
}

export function runSuperProjection(inputs: SuperInputs): SuperResult {
  const {
    currentBalance, currentAge, retirementAge,
    salaryExcSuper, sgRate, investmentReturn,
    additionalContribs, fundFeePercent,
    inflationRate, salaryGrowthRate, desiredRetirementIncome,
  } = inputs

  const startYear     = inputs.startYear ?? new Date().getFullYear()
  const startFyEnding  = inputs.startFyEnding ?? currentFinancialYearEnding()
  const firstYearCapBonus = inputs.firstYearCapBonus ?? 0

  const rows: SuperRow[] = []
  let balance = currentBalance
  let salary  = salaryExcSuper
  let count   = 0

  // ── Accumulation phase ────────────────────────────────────────────────────
  for (let age = currentAge; age < retirementAge; age++) {
    const yearsFromNow = age - currentAge
    const year     = startYear + yearsFromNow
    const fyEnding = startFyEnding + yearsFromNow

    const earnings    = balance * investmentReturn
    const earningsTax = earnings * 0.15

    const gross        = salary * sgRate + additionalContribs
    // Carry-forward headroom (unused cap from the last 5 FYs) applies only
    // in the run's first year — see computeCarryForward in lib/superHistory.ts.
    const cap          = legislativeCap(fyEnding) + (yearsFromNow === 0 ? firstYearCapBonus : 0)
    const contribution = Math.min(gross, cap)
    const capHit       = gross > cap

    const div293          = salary > DIV293_THRESHOLD
    const contributionTax = contribution * (div293 ? 0.30 : 0.15)

    const fees    = balance * fundFeePercent
    balance       = balance + earnings - earningsTax + contribution - contributionTax - fees
    const presentValue = balance / Math.pow(1 + inflationRate, yearsFromNow + 1)

    rows.push({
      count, age, year, phase: 'accumulation',
      balance, earnings, earningsTax,
      contribution, contributionTax,
      fees, drawdown: 0,
      salary, presentValue, capHit, div293, fyEnding,
    })

    salary *= (1 + salaryGrowthRate)
    count++
  }

  const yearsToRetirement   = retirementAge - currentAge
  const retirementBalance   = balance
  const retirementBalancePV = balance / Math.pow(1 + inflationRate, yearsToRetirement)
  const monthlyIncomeToday  = desiredRetirementIncome / 12

  let depletionAge: number | null = null

  // ── Drawdown (pension) phase — earnings completely tax-free ───────────────
  for (let age = retirementAge; age < 100; age++) {
    const yearsFromNow = age - currentAge
    const year         = startYear + yearsFromNow
    const fyEnding     = startFyEnding + yearsFromNow

    const earnings  = balance * investmentReturn
    const fees      = balance * fundFeePercent
    const drawdown  = desiredRetirementIncome * Math.pow(1 + inflationRate, yearsFromNow)
    const newBalance = Math.max(0, balance + earnings - fees - drawdown)
    const presentValue = newBalance / Math.pow(1 + inflationRate, yearsFromNow)

    rows.push({
      count, age, year, phase: 'drawdown',
      balance: newBalance,
      earnings, earningsTax: 0,
      contribution: 0, contributionTax: 0,
      fees, drawdown,
      salary: 0, presentValue, fyEnding,
      capHit: false, div293: false,
    })

    if (balance + earnings - fees - drawdown < 0 && depletionAge === null) {
      depletionAge = age + 1
    }
    balance = newBalance
    count++
    if (balance <= 0) break
  }

  const yearsOfIncome = depletionAge !== null ? depletionAge - retirementAge : null

  return {
    rows,
    retirementBalance,
    retirementBalancePV,
    monthlyIncomeToday,
    depletionAge,
    yearsOfIncome,
  }
}

export function runHouseholdProjection(
  inputs: HouseholdSuperInputs,
  ctx: ProjectionContext,
): HouseholdSuperResult {
  // Each person funds half the household income goal
  const perPersonIncome = inputs.desiredRetirementIncome / (inputs.partnerEnabled ? 2 : 1)

  // Resolve once and thread through both persons, so they share a single
  // run-start rather than each independently reading the wall clock.
  const startYear     = ctx.startYear ?? new Date().getFullYear()
  const startFyEnding  = ctx.startFyEnding ?? currentFinancialYearEnding()

  const p1Inputs: SuperInputs = {
    currentBalance:          inputs.person1Balance,
    currentAge:              ctx.person1Age,
    retirementAge:           inputs.person1RetirementAge,
    salaryExcSuper:          ctx.person1Salary,
    sgRate:                  inputs.sgRate,
    investmentReturn:        inputs.investmentReturn,
    additionalContribs:      inputs.person1AdditionalContribs,
    fundFeePercent:          inputs.fundFeePercent,
    inflationRate:           inputs.inflationRate,
    salaryGrowthRate:        ctx.person1SalaryGrowth,
    desiredRetirementIncome: perPersonIncome,
    startYear, startFyEnding,
    firstYearCapBonus:       inputs.person1CapCarryForward ?? 0,
  }
  const p1Result = runSuperProjection(p1Inputs)

  if (!inputs.partnerEnabled) {
    const combined: CombinedRow[] = p1Result.rows.map(r => ({
      year:           r.year,
      person1Age:     r.age,
      person2Age:     ctx.person2Age + (r.year - startYear),
      person1Balance: r.balance,
      person2Balance: 0,
      total:          r.balance,
      totalPV:        r.presentValue,
    }))
    return {
      person1:                   p1Result,
      person2:                   null,
      combined,
      combinedDepletionAge:      p1Result.depletionAge,
      combinedRetirementTotal:   p1Result.retirementBalance,
      combinedRetirementTotalPV: p1Result.retirementBalancePV,
      monthlyIncomeGoal:         inputs.desiredRetirementIncome / 12,
    }
  }

  const p2Inputs: SuperInputs = {
    currentBalance:          inputs.person2Balance,
    currentAge:              ctx.person2Age,
    retirementAge:           inputs.person2RetirementAge,
    salaryExcSuper:          ctx.person2Salary,
    sgRate:                  inputs.sgRate,
    investmentReturn:        inputs.investmentReturn,
    additionalContribs:      inputs.person2AdditionalContribs,
    fundFeePercent:          inputs.fundFeePercent,
    inflationRate:           inputs.inflationRate,
    salaryGrowthRate:        ctx.person2SalaryGrowth,
    desiredRetirementIncome: perPersonIncome,
    startYear, startFyEnding,
    firstYearCapBonus:       inputs.person2CapCarryForward ?? 0,
  }
  const p2Result = runSuperProjection(p2Inputs)

  // Build year-aligned combined rows
  const p1ByYear: Record<number, SuperRow> = {}
  const p2ByYear: Record<number, SuperRow> = {}
  for (const r of p1Result.rows) p1ByYear[r.year] = r
  for (const r of p2Result.rows) p2ByYear[r.year] = r

  const allYears = Array.from(new Set([
    ...p1Result.rows.map(r => r.year),
    ...p2Result.rows.map(r => r.year),
  ])).sort((a, b) => a - b)

  const combined: CombinedRow[] = allYears.map(year => {
    const yearsFromNow = year - startYear
    const b1  = p1ByYear[year]?.balance ?? 0
    const b2  = p2ByYear[year]?.balance ?? 0
    const total = b1 + b2
    const totalPV = total / Math.pow(1 + inputs.inflationRate, yearsFromNow)
    return {
      year,
      person1Age:     ctx.person1Age + yearsFromNow,
      person2Age:     ctx.person2Age + yearsFromNow,
      person1Balance: b1,
      person2Balance: b2,
      total,
      totalPV,
    }
  })

  // Depletion: first year total balance hits zero
  const depletionRow         = combined.find(c => c.total <= 0)
  const combinedDepletionAge = depletionRow
    ? ctx.person1Age + (depletionRow.year - startYear)
    : null

  // Combined balance at the later retirement year
  const p1RetYear  = startYear + (inputs.person1RetirementAge - ctx.person1Age)
  const p2RetYear  = startYear + (inputs.person2RetirementAge - ctx.person2Age)
  const laterRetYear = Math.max(p1RetYear, p2RetYear)
  const atRetirement = combined.find(c => c.year === laterRetYear) ?? combined[combined.length - 1]

  return {
    person1:                   p1Result,
    person2:                   p2Result,
    combined,
    combinedDepletionAge,
    combinedRetirementTotal:   atRetirement.total,
    combinedRetirementTotalPV: atRetirement.totalPV,
    monthlyIncomeGoal:         inputs.desiredRetirementIncome / 12,
  }
}
