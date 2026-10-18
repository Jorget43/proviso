import { describe, it, expect } from 'vitest'
import {
  readOverrides, validOverrides, patchOverrides, writeOverrides, applyScenario, runScenarios, summariseRun,
  scenarioColour, nextScenarioColour, countChanges, type ScenarioLike,
} from '../src/scenarios'
import { projectionBaseline, buildProjectionInputs, type BaselineSource, type ProjectionLive } from '../src/future'
import { runProjections, type ProjectionOutput, type ProjectionResult } from '../src/projections'
import { SF_BASE } from '../src/schoolFees'
import { EDUCATION_PRESETS } from '../src/educationCosts'

type E = { id: number; cat: string; name: string; freq: string; amt: number }

// A made-up household: one adult, 40, $120k, a $500k loan.
const source: BaselineSource<E> = {
  expenses: [
    { id: 1, cat: 'Food', name: 'Groceries', freq: 'monthly', amt: 1000 },
    { id: 2, cat: 'Home', name: 'Mortgage', freq: 'monthly', amt: 3000 },
  ],
  annualExpenses: [],
  income: { taxMode: true, person1FTE: 120_000, person2FTE: 0, person1HasHELP: false, person2HasHELP: false, person1MonthlyNet: 0, person2MonthlyNet: 0 },
  childcare: { enabled: false, costPerDay: 150, daysPerWeek: 3, numChildren: 1 },
  rentMonthly: null,
  person1Days: 5, person2Days: 5, partnerEnabled: false,
  person1Name: 'Alex', person2Name: 'Sam',
  debts: [],
  assets: [{ name: 'Savings', amt: 30_000, isOffset: true }, { name: 'Home equity', amt: 400_000, isOffset: false }],
  mortgage: { balance: 500_000 },
}
const baseline = projectionBaseline(source)

const live: ProjectionLive = {
  income: source.income,
  settings: {
    person1Growth: 3, person2Growth: 3, expInflNear: 3, expInfl: 2.5, childcareInfl: 6, propGrowth: 3.5,
    savingsRate: 50, investReturn: 5, projYears: 20, schoolFeesOn: false,
    sfC1Start: 2030, sfC1ExitIdx: 13, sfC2Start: 2033, sfC2ExitIdx: 13, sfInfl: 5, sfPresetKey: null, parentalLeaveEnabled: false,
    horizonAge: 90,
  },
  person1Phases: [], person2Phases: [], oneoffs: [], lifePhases: [],
  sfSchedule: SF_BASE,
  rent: {
    enabled: false, monthlyRent: 0, annualIncreaseRate: 5, purchasePlanEnabled: false, targetPurchaseYear: 2031,
    targetPropertyValue: 800_000, depositPct: 20, depositFromCash: 0, depositFromInvestments: 0, newMortgageRate: 6, newMortgageTermYrs: 30,
  },
  mortgage: { rate: 6, payment: 3000 },
  currentYear: 2026,
  life: {
    partnerEnabled: false, person1Age: 40, person2Age: 40,
    super: {
      sgRate: 0.12, investmentReturn: 0.07, fundFeePercent: 0.005, inflationRate: 0.025, desiredRetirementIncome: 0,
      person1Balance: 150_000, person1RetirementAge: 67, person1AdditionalContribs: 0,
      person2Balance: 0, person2RetirementAge: 67, person2AdditionalContribs: 0,
    },
  },
  children: [],
}

const scenario = (overrides: object, over: Partial<ScenarioLike> = {}): ScenarioLike =>
  ({ id: 's1', name: 'Test', colour: 'amber', enabled: true, overrides: JSON.stringify(overrides), ...over })

describe('reading the stored changes', () => {
  it('treats anything unreadable as no changes', () => {
    expect(readOverrides(null)).toEqual({})
    expect(readOverrides('')).toEqual({})
    expect(readOverrides('not json')).toEqual({})
    expect(readOverrides('[1,2]')).toEqual({})
    expect(readOverrides('"text"')).toEqual({})
  })

  it('keeps each valid field and drops only the bad ones', () => {
    const o = validOverrides({
      settings: { savingsRate: 30, investReturn: 'lots', funPct: 500, newerSetting: 1 },
      super:    { person1RetirementAge: 55, person1Balance: 1_000_000 },  // balances are facts, not scenario choices
      rent:     { enabled: true, targetPurchaseYear: 2030 },               // renting vs owning isn't a scenario choice
      person1Phases: [{ year: 2028, days: 3 }, { year: 2029, days: 9 }, 'junk'],
      oneoffs:  'not a list',
      children: [{ birthYear: 2028 }],
      somethingNewer: { x: 1 },
    })
    expect(o).toEqual({
      settings: { savingsRate: 30 },
      super:    { person1RetirementAge: 55 },
      rent:     { targetPurchaseYear: 2030 },
      person1Phases: [{ year: 2028, days: 3 }],
      children: [{ name: null, birthYear: 2028, birthMonth: null }],
    })
  })

  it('leaves out sections with nothing valid in them', () => {
    expect(validOverrides({ settings: { investReturn: 'lots' }, super: [] })).toEqual({})
  })
})

describe('patchOverrides', () => {
  it('merges settings, replaces lists, and removes a section with null', () => {
    let raw = patchOverrides({}, { settings: { savingsRate: 30 } })
    raw = patchOverrides(raw, { settings: { funPct: 10 }, person1Phases: [{ year: 2028, days: 3 }] })
    expect(raw).toEqual({ settings: { savingsRate: 30, funPct: 10 }, person1Phases: [{ year: 2028, days: 3 }] })
    raw = patchOverrides(raw, { person1Phases: [{ year: 2030, days: 4 }], settings: null })
    expect(raw).toEqual({ person1Phases: [{ year: 2030, days: 4 }] })
  })

  it('keeps what a newer app version stored', () => {
    const fromNewer = readOverrides(JSON.stringify({ settings: { savingsRate: 30, newerSetting: 7 }, newerSection: [1] }))
    const raw = patchOverrides(fromNewer, { settings: { funPct: 10 } })
    expect(readOverrides(writeOverrides(raw))).toEqual({ settings: { savingsRate: 30, newerSetting: 7, funPct: 10 }, newerSection: [1] })
  })

  it('counts the changes', () => {
    expect(countChanges({})).toBe(0)
    expect(countChanges({ settings: { savingsRate: 30, funPct: 10 }, super: { person1RetirementAge: 55 }, oneoffs: [] })).toBe(4)
  })
})

describe('applyScenario', () => {
  it('with no changes is exactly the plan', () => {
    expect(buildProjectionInputs(baseline, applyScenario(live, {}))).toEqual(buildProjectionInputs(baseline, live))
    const [r] = runScenarios(baseline, live, [scenario({})])
    expect(r.output).toEqual(runProjections(buildProjectionInputs(baseline, live)))
  })

  it('layers changes on the plan without touching it', () => {
    const before = JSON.stringify(live)
    const l = applyScenario(live, {
      settings: { savingsRate: 20 },
      super: { person1RetirementAge: 55 },
      rent: { targetPurchaseYear: 2030 },
      person1Phases: [{ year: 2026, days: 5 }, { year: 2028, days: 3 }],
      oneoffs: [{ name: 'Car', amt: 40_000, year: 2029 }],
    })
    expect(JSON.stringify(live)).toBe(before)
    expect(l.settings.savingsRate).toBe(20)
    expect(l.settings.investReturn).toBe(5)                 // the rest follows the plan
    expect(l.life?.super.person1RetirementAge).toBe(55)
    expect(l.life?.super.person1Balance).toBe(150_000)
    expect(l.rent.targetPurchaseYear).toBe(2030)
    expect(l.rent.enabled).toBe(false)
    expect(l.person1Phases).toHaveLength(2)
    expect(l.oneoffs).toEqual([{ name: 'Car', amt: 40_000, year: 2029 }])
  })

  it('retiring at 55 stops pay in 2041 instead of 2053', () => {
    // 40 in 2026: 55 in 2041, 67 in 2053.
    const [r] = runScenarios(baseline, live, [scenario({ super: { person1RetirementAge: 55 } })])
    const plan = runProjections(buildProjectionInputs(baseline, live))
    expect(plan.base.person1RetireYr).toBe(2053)
    expect(r.output.base.person1RetireYr).toBe(2041)
  })

  it('switches the school-fee table with the school type', () => {
    const key = Object.keys(EDUCATION_PRESETS)[0]
    expect(applyScenario(live, { settings: { sfPresetKey: key } }).sfSchedule).toEqual(EDUCATION_PRESETS[key].schedule)
    // Back to "Custom": the household's own table.
    const own = { ...SF_BASE, Prep: { tuition: 1, fixed: 2 } }
    expect(applyScenario({ ...live, sfSchedule: EDUCATION_PRESETS[key].schedule }, { settings: { sfPresetKey: null } }, own).sfSchedule).toBe(own)
    // Not mentioned: unchanged.
    expect(applyScenario(live, { settings: { savingsRate: 1 } }).sfSchedule).toBe(live.sfSchedule)
  })

  it('a planned baby reaches the life-stage costs', () => {
    const inputs = buildProjectionInputs(baseline, applyScenario(live, { children: [{ name: null, birthYear: 2028, birthMonth: null }] }))
    expect(inputs.lifeStages?.childBirthYears).toEqual([2028])
  })

  it('gives each run its colour, falling back by position', () => {
    const runs = runScenarios(baseline, live, [scenario({}, { colour: 'pink' }), scenario({}, { colour: 'mauve' })])
    expect(runs.map(r => r.colour)).toEqual(['pink', 'amber'])
  })
})

describe('colours', () => {
  it('picks the first free one, then repeats', () => {
    expect(scenarioColour(null, 0)).toBe('blue')
    expect(scenarioColour('teal')).toBe('teal')
    expect(nextScenarioColour([])).toBe('blue')
    expect(nextScenarioColour(['blue', 'pink'])).toBe('amber')
    expect(nextScenarioColour(['blue', 'amber', 'pink', 'teal', 'purple'])).toBe('blue')
  })
})

describe('summariseRun', () => {
  // A hand-made five-year run, so every figure can be checked by eye.
  const result = (over: Partial<ProjectionResult>): ProjectionResult => ({
    nwArr: [100, 120, 130, 125, 140], deficitArr: [10, -5, 3, -8, -20], cashArr: [50, 40, 20, 35, 60],
    retiredArr: [false, false, false, true, true], sfTotalArr: [0, 1000, 2000, 0, 0], shortfallYr: null,
    ...over,
  } as ProjectionResult)
  const out = (r: ProjectionResult): ProjectionOutput => ({ base: r, withFees: null, labels: ['2027', '2028', '2029', '2030', '2031'] })

  it('reads the figures for the Compare card', () => {
    const s = summariseRun(out(result({})), { currentYear: 2026, settings: { ...live.settings, schoolFeesOn: true }, life: live.life })
    expect(s).toEqual({
      endYear: 2031, endNetWorth: 140,
      tightYear: 2028,                        // −5 in 2028; 2030–31 are retirement, so don't count
      runsOutAge: null, lastAge: 45,          // 40 + 5 years
      schoolFees: 3000,                       // 1,000 + 2,000
      lowestCash: { year: 2029, value: 20 },
    })
  })

  it('gives the age money runs short, and no fees when they’re off', () => {
    const s = summariseRun(out(result({ shortfallYr: 2030, deficitArr: [1, 1, 1, -1, -1] })), { currentYear: 2026, settings: live.settings, life: live.life })
    expect(s.runsOutAge).toBe(44)             // 40 + (2030 − 2026)
    expect(s.tightYear).toBeNull()
    expect(s.schoolFees).toBe(0)
  })
})
