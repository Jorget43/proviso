// Fixtures for lib/projections.ts tests.
//
// The baseline is deliberately ARITHMETICALLY INERT: every growth, inflation
// and return dial is 0 so each named scenario can switch on exactly one
// mechanism and the expected values stay hand-derivable in the test file.
//
// Values are round placeholders, not schema defaults — see CLAUDE.md's
// privacy rule (defaults are a floor, not a source to copy from).
//
// UNITS: ProjectionInputs rates are PERCENTAGES (3.5 means 3.5%), matching
// the DB's ProjectionSettings convention. Do not confuse with lib/super.ts
// fixtures, whose rates are decimals.

import type { ProjectionInputs } from '@/lib/projections'

/** Fixture run-start year. Both persons are full-time from this year. */
export const FX_YEAR = 2026

export function makeProjectionInputs(overrides: Partial<ProjectionInputs> = {}): ProjectionInputs {
  return {
    // ── Income: both on $120k so calcAfterTax(120000)=90812 (tests/tax.test.ts:74) is reused ──
    person1FTE: 120_000,
    person2FTE: 120_000,
    taxMode: true,
    person2HasHELP: false,
    person2HELPBalance: 0,
    person1MonthlyNet: 7_000,
    person2MonthlyNet: 7_000,

    // ── All growth/inflation/return dials off ──
    person1GrowthRate: 0,
    person2GrowthRate: 0,
    expInflNear: 0,
    expInfl: 0,
    childcareInfl: 0,
    propGrowth: 0,
    savingsRate: 0,
    investReturn: 0,

    projYears: 5,

    // ── Balances: round, reconstructable numbers ──
    mortBalance: 400_000,
    mortRate: 6.0,
    mortPayment: 3_000,
    cashOnHand: 50_000,
    propValue: 800_000,
    cryptoValue: 10_000,
    helpDebt: 0,

    // ── Both persons full-time from the fixture year ──
    person1Phases: [{ year: FX_YEAR, days: 5 }],
    person2Phases: [{ year: FX_YEAR, days: 5 }],

    baseMonthlyExpenses: 8_000, // → $96,000/yr
    oneoffs: [],
    parentalLeaveEnabled: true,

    // ── School fees off; sfInfl 0 so the schedule's literal numbers appear when toggled on ──
    schoolFeesOn: false,
    sfC1Start: FX_YEAR + 1,
    sfC1ExitIdx: 13,
    sfC2Start: FX_YEAR + 3,
    sfC2ExitIdx: 13,
    sfInfl: 0,
    sfSchedule: undefined, // undefined → engine falls back to SF_BASE

    lifePhases: [],
    currentYear: FX_YEAR,

    // ── Homeowner, no renter/purchase plan ──
    rentMode: false,
    monthlyRent: 0,
    rentIncreaseRate: 0,
    purchasePlanEnabled: false,
    targetPurchaseYear: FX_YEAR + 3,
    targetPropertyValue: 800_000,
    depositPct: 20,
    depositFromCash: 0,
    depositFromInvestments: 0,
    newMortgageRate: 6.0,
    newMortgageTermYrs: 30,

    ...overrides,
  }
}

/** Renter baseline: no mortgage/property, rent tracked separately. */
export function renter(overrides: Partial<ProjectionInputs> = {}): ProjectionInputs {
  return makeProjectionInputs({
    rentMode: true,
    monthlyRent: 2_500,
    rentIncreaseRate: 0,
    mortBalance: 0,
    mortPayment: 0,
    propValue: 0,
    ...overrides,
  })
}

/** Renter with a purchase plan kicking in `offset` years from FX_YEAR. */
export function renterBuyingIn(offset: number, overrides: Partial<ProjectionInputs> = {}): ProjectionInputs {
  return renter({
    purchasePlanEnabled: true,
    targetPurchaseYear: FX_YEAR + offset,
    ...overrides,
  })
}

/**
 * Person 2 takes parental leave (days: 0) starting `leaveYear`, returning at
 * `returnDays` days/week the following year.
 */
export function withLeave(leaveYear: number, returnDays: number, overrides: Partial<ProjectionInputs> = {}): ProjectionInputs {
  return makeProjectionInputs({
    person2Phases: [
      { year: FX_YEAR, days: 5 },
      { year: leaveYear, days: 0 },
      { year: leaveYear + 1, days: returnDays },
    ],
    ...overrides,
  })
}
