// Fixtures for lib/super.ts and lib/superHistory.ts tests.
//
// UNITS: SuperInputs/HouseholdSuperInputs rates are DECIMALS (0.06 = 6%),
// matching the DB's SuperSettings convention — NOT percentages like the
// projections fixtures. Do not cross the streams.
//
// Values are round placeholders, not schema defaults — see CLAUDE.md's
// privacy rule.

import type { SuperInputs, HouseholdSuperInputs, ProjectionContext } from '@/lib/super'

/** Fixture run-start calendar year and financial-year-ending. */
export const FX_YEAR = 2026
export const FX_FY_ENDING = 2027

export function makeSuperInputs(overrides: Partial<SuperInputs> = {}): SuperInputs {
  return {
    currentBalance: 100_000,
    currentAge: 40,
    retirementAge: 41, // one accumulation year by default — hand-derivable
    salaryExcSuper: 100_000,
    sgRate: 0.12,
    investmentReturn: 0.06,
    additionalContribs: 0,
    fundFeePercent: 0.005,
    inflationRate: 0, // PV === nominal unless a test overrides this
    salaryGrowthRate: 0,
    desiredRetirementIncome: 40_000,
    startYear: FX_YEAR,
    startFyEnding: FX_FY_ENDING,
    ...overrides,
  }
}

export function makeHouseholdInputs(overrides: Partial<HouseholdSuperInputs> = {}): HouseholdSuperInputs {
  return {
    sgRate: 0.12,
    investmentReturn: 0.06,
    fundFeePercent: 0.005,
    inflationRate: 0,
    desiredRetirementIncome: 80_000,

    person1Balance: 100_000,
    person1RetirementAge: 67,
    person1AdditionalContribs: 0,

    partnerEnabled: true,
    person2Balance: 100_000,
    person2RetirementAge: 67,
    person2AdditionalContribs: 0,

    ...overrides,
  }
}

export function makeContext(overrides: Partial<ProjectionContext> = {}): ProjectionContext {
  return {
    person1Age: 40,
    person1Salary: 100_000,
    person1SalaryGrowth: 0,
    person2Age: 40,
    person2Salary: 100_000,
    person2SalaryGrowth: 0,
    startYear: FX_YEAR,
    startFyEnding: FX_FY_ENDING,
    ...overrides,
  }
}
