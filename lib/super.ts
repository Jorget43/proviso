const CURRENT_YEAR = new Date().getFullYear()
const CONCESSIONAL_CAP_BASE = 30_000   // FY25
const DIV293_THRESHOLD      = 250_000

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

  // Jorge
  jorgeBalance:             number
  jorgeRetirementAge:       number
  jorgeAdditionalContribs:  number

  // Grace (partner)
  partnerEnabled:           boolean
  graceBalance:             number
  graceRetirementAge:       number
  graceAdditionalContribs:  number
}

export interface ProjectionContext {
  jorgeAge:          number
  jorgeSalary:       number
  jorgeSalaryGrowth: number  // decimal e.g. 0.035
  graceAge:          number
  graceSalary:       number
  graceSalaryGrowth: number
}

export interface CombinedRow {
  year:         number
  jorgeAge:     number
  graceAge:     number
  jorgeBalance: number
  graceBalance: number
  total:        number
  totalPV:      number
}

export interface HouseholdSuperResult {
  jorge:                     SuperResult
  grace:                     SuperResult | null
  combined:                  CombinedRow[]
  combinedDepletionAge:      number | null   // Jorge's age when combined pool depletes
  combinedRetirementTotal:   number
  combinedRetirementTotalPV: number
  monthlyIncomeGoal:         number
}

// Concessional cap grows with AWOTE (~3.5 %), rounded to nearest $2,500
function concessionalCap(yearsFromNow: number): number {
  const raw = CONCESSIONAL_CAP_BASE * Math.pow(1.035, yearsFromNow)
  return Math.round(raw / 2500) * 2500
}

export function runSuperProjection(inputs: SuperInputs): SuperResult {
  const {
    currentBalance, currentAge, retirementAge,
    salaryExcSuper, sgRate, investmentReturn,
    additionalContribs, fundFeePercent,
    inflationRate, salaryGrowthRate, desiredRetirementIncome,
  } = inputs

  const rows: SuperRow[] = []
  let balance = currentBalance
  let salary  = salaryExcSuper
  let count   = 0

  // ── Accumulation phase ────────────────────────────────────────────────────
  for (let age = currentAge; age < retirementAge; age++) {
    const yearsFromNow = age - currentAge
    const year = CURRENT_YEAR + yearsFromNow

    const earnings    = balance * investmentReturn
    const earningsTax = earnings * 0.15

    const gross        = salary * sgRate + additionalContribs
    const cap          = concessionalCap(yearsFromNow)
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
      salary, presentValue, capHit, div293,
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
    const year         = CURRENT_YEAR + yearsFromNow

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
      salary: 0, presentValue,
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

  const jorgeInputs: SuperInputs = {
    currentBalance:          inputs.jorgeBalance,
    currentAge:              ctx.jorgeAge,
    retirementAge:           inputs.jorgeRetirementAge,
    salaryExcSuper:          ctx.jorgeSalary,
    sgRate:                  inputs.sgRate,
    investmentReturn:        inputs.investmentReturn,
    additionalContribs:      inputs.jorgeAdditionalContribs,
    fundFeePercent:          inputs.fundFeePercent,
    inflationRate:           inputs.inflationRate,
    salaryGrowthRate:        ctx.jorgeSalaryGrowth,
    desiredRetirementIncome: perPersonIncome,
  }
  const jorgeResult = runSuperProjection(jorgeInputs)

  if (!inputs.partnerEnabled) {
    const combined: CombinedRow[] = jorgeResult.rows.map(r => ({
      year:         r.year,
      jorgeAge:     r.age,
      graceAge:     ctx.graceAge + (r.year - CURRENT_YEAR),
      jorgeBalance: r.balance,
      graceBalance: 0,
      total:        r.balance,
      totalPV:      r.presentValue,
    }))
    return {
      jorge:                     jorgeResult,
      grace:                     null,
      combined,
      combinedDepletionAge:      jorgeResult.depletionAge,
      combinedRetirementTotal:   jorgeResult.retirementBalance,
      combinedRetirementTotalPV: jorgeResult.retirementBalancePV,
      monthlyIncomeGoal:         inputs.desiredRetirementIncome / 12,
    }
  }

  const graceInputs: SuperInputs = {
    currentBalance:          inputs.graceBalance,
    currentAge:              ctx.graceAge,
    retirementAge:           inputs.graceRetirementAge,
    salaryExcSuper:          ctx.graceSalary,
    sgRate:                  inputs.sgRate,
    investmentReturn:        inputs.investmentReturn,
    additionalContribs:      inputs.graceAdditionalContribs,
    fundFeePercent:          inputs.fundFeePercent,
    inflationRate:           inputs.inflationRate,
    salaryGrowthRate:        ctx.graceSalaryGrowth,
    desiredRetirementIncome: perPersonIncome,
  }
  const graceResult = runSuperProjection(graceInputs)

  // Build year-aligned combined rows
  const jorgeByYear: Record<number, SuperRow> = {}
  const graceByYear: Record<number, SuperRow> = {}
  for (const r of jorgeResult.rows) jorgeByYear[r.year] = r
  for (const r of graceResult.rows) graceByYear[r.year] = r

  const allYears = Array.from(new Set([
    ...jorgeResult.rows.map(r => r.year),
    ...graceResult.rows.map(r => r.year),
  ])).sort((a, b) => a - b)

  const combined: CombinedRow[] = allYears.map(year => {
    const yearsFromNow = year - CURRENT_YEAR
    const jBal = jorgeByYear[year]?.balance ?? 0
    const gBal = graceByYear[year]?.balance ?? 0
    const total = jBal + gBal
    const totalPV = total / Math.pow(1 + inputs.inflationRate, yearsFromNow)
    return {
      year,
      jorgeAge:     ctx.jorgeAge + yearsFromNow,
      graceAge:     ctx.graceAge + yearsFromNow,
      jorgeBalance: jBal,
      graceBalance: gBal,
      total,
      totalPV,
    }
  })

  // Depletion: first year total balance hits zero
  const depletionRow     = combined.find(c => c.total <= 0)
  const combinedDepletionAge = depletionRow
    ? ctx.jorgeAge + (depletionRow.year - CURRENT_YEAR)
    : null

  // Combined balance at the later retirement year
  const jorgeRetYear   = CURRENT_YEAR + (inputs.jorgeRetirementAge - ctx.jorgeAge)
  const graceRetYear   = CURRENT_YEAR + (inputs.graceRetirementAge - ctx.graceAge)
  const laterRetYear   = Math.max(jorgeRetYear, graceRetYear)
  const atRetirement   = combined.find(c => c.year === laterRetYear) ?? combined[combined.length - 1]

  return {
    jorge:                     jorgeResult,
    grace:                     graceResult,
    combined,
    combinedDepletionAge,
    combinedRetirementTotal:   atRetirement.total,
    combinedRetirementTotalPV: atRetirement.totalPV,
    monthlyIncomeGoal:         inputs.desiredRetirementIncome / 12,
  }
}
