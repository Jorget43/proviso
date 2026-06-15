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

  // Person 1
  person1Balance:             number
  person1RetirementAge:       number
  person1AdditionalContribs:  number

  // Person 2 (partner)
  partnerEnabled:             boolean
  person2Balance:             number
  person2RetirementAge:       number
  person2AdditionalContribs:  number
}

export interface ProjectionContext {
  person1Age:          number
  person1Salary:       number
  person1SalaryGrowth: number  // decimal e.g. 0.035
  person2Age:          number
  person2Salary:       number
  person2SalaryGrowth: number
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
  }
  const p1Result = runSuperProjection(p1Inputs)

  if (!inputs.partnerEnabled) {
    const combined: CombinedRow[] = p1Result.rows.map(r => ({
      year:           r.year,
      person1Age:     r.age,
      person2Age:     ctx.person2Age + (r.year - CURRENT_YEAR),
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
    const yearsFromNow = year - CURRENT_YEAR
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
    ? ctx.person1Age + (depletionRow.year - CURRENT_YEAR)
    : null

  // Combined balance at the later retirement year
  const p1RetYear  = CURRENT_YEAR + (inputs.person1RetirementAge - ctx.person1Age)
  const p2RetYear  = CURRENT_YEAR + (inputs.person2RetirementAge - ctx.person2Age)
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
