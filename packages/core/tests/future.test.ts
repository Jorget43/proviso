import { describe, it, expect } from 'vitest'
import { projectionBaseline, buildProjectionInputs, retirementIncomeGoal, spendingInRetirement, feeScheduleFor, isModelledSchoolLine, type BaselineSource, type ProjectionLive } from '../src/future'
import { runProjections } from '../src/projections'
import { SF_BASE } from '../src/schoolFees'
import { EDUCATION_PRESETS } from '../src/educationCosts'

type E = { id: number; cat: string; name: string; freq: string; amt: number }

const source = (over: Partial<BaselineSource<E>> = {}): BaselineSource<E> => ({
  expenses: [
    { id: 1, cat: 'Food', name: 'Groceries', freq: 'monthly', amt: 1000 },
    { id: 2, cat: 'Home', name: 'Mortgage', freq: 'monthly', amt: 3000 },
  ],
  annualExpenses: [{ id: 3, cat: 'Transport', name: 'Car rego', amt: 1200, month: 7 }],
  income: { taxMode: true, person1FTE: 120_000, person2FTE: 0, person1HasHELP: false, person2HasHELP: false, person1MonthlyNet: 0, person2MonthlyNet: 0 },
  childcare: { enabled: false, costPerDay: 150, daysPerWeek: 3, numChildren: 1 },
  rentMonthly: null,
  person1Days: 5, person2Days: 5, partnerEnabled: false,
  person1Name: 'Alex', person2Name: 'Sam',
  debts: [{ name: 'Alex HELP debt', amt: 20_000 }, { name: 'Car loan', amt: 10_000 }],
  assets: [{ name: 'Savings', amt: 30_000, isOffset: true }, { name: 'Home equity', amt: 400_000, isOffset: false }],
  mortgage: { balance: 500_000 },
  ...over,
})

const settings = {
  person1Growth: 3, person2Growth: 3, expInflNear: 3, expInfl: 2.5, childcareInfl: 6, propGrowth: 3.5,
  savingsRate: 50, investReturn: 5, projYears: 20, schoolFeesOn: false,
  sfC1Start: 2030, sfC1ExitIdx: 13, sfC2Start: 2033, sfC2ExitIdx: 13, sfInfl: 5, sfPresetKey: null, parentalLeaveEnabled: false,
}
const rent = {
  enabled: false, monthlyRent: 0, annualIncreaseRate: 5, purchasePlanEnabled: false, targetPurchaseYear: 2031,
  targetPropertyValue: 800_000, depositPct: 20, depositFromCash: 0, depositFromInvestments: 0, newMortgageRate: 6, newMortgageTermYrs: 30,
}
const live = (over: Partial<ProjectionLive> = {}): ProjectionLive => ({
  income: source().income, settings, person1Phases: [], person2Phases: [], oneoffs: [], lifePhases: [],
  sfSchedule: SF_BASE, rent, mortgage: { rate: 6, payment: 3000 }, currentYear: 2026, ...over,
})

describe('projectionBaseline', () => {
  it('starts from the budget’s spending, yearly bills included', () => {
    const b = projectionBaseline(source())
    expect(b.budgetMonthlyExpenses).toBe(1000 + 3000 + 100)
    expect(b.baseMonthlyExpenses).toBe(4100)
    expect(b.budgetMortgageMonthly).toBe(3000)
  })

  it('takes rent out (the engine grows it separately) and adds childcare after the subsidy', () => {
    const b = projectionBaseline(source({ rentMonthly: 2500, childcare: { enabled: true, costPerDay: 150, daysPerWeek: 3, numChildren: 1 },
      expenses: [...source().expenses, { id: 9, cat: 'Children', name: 'Childcare', freq: 'monthly', amt: 0 }] }))
    expect(b.budgetMonthlyExpenses).toBeGreaterThan(4100 + 2500)  // childcare counted
    expect(b.baseMonthlyExpenses).toBeCloseTo(b.budgetMonthlyExpenses - 2500)
  })

  it('splits debts: HELP repaid in the engine, the rest held flat; net worth matches', () => {
    const b = projectionBaseline(source())
    expect(b.person1HELPBalance).toBe(20_000)
    expect(b.otherDebts).toBe(10_000)
    expect(b.netWorthToday).toBe(30_000 + 400_000 - 30_000)
    expect(b.mortBalance).toBe(500_000)
    expect(b.propValue).toBe(900_000)
  })
})

describe('buildProjectionInputs', () => {
  it('takes the loan repayment out while the engine pays the loan', () => {
    const i = buildProjectionInputs(projectionBaseline(source()), live())
    expect(i.baseMonthlyExpenses).toBe(1100)
    expect(i.mortPayment).toBe(3000)
    expect(i.person1HasHELP).toBe(true)
  })

  it('falls back to the budget line when no repayment is recorded', () => {
    expect(buildProjectionInputs(projectionBaseline(source()), live({ mortgage: { rate: 6, payment: 0 } })).mortPayment).toBe(3000)
  })

  it('takes the two eldest children’s school costs out only while the fee model is on', () => {
    const src = source({ expenses: [...source().expenses,
      { id: 7, cat: 'Children', name: 'School costs: Child 1 (age 7)', freq: 'yearly', amt: 12_000 },
      { id: 8, cat: 'Children', name: 'School costs: Child 3 (age 5)', freq: 'yearly', amt: 6_000 }] })
    const b = projectionBaseline(src)
    expect(b.modelledSchoolMonthly).toBe(1000)
    expect(buildProjectionInputs(b, live()).baseMonthlyExpenses).toBe(1100 + 1000 + 500)
    expect(buildProjectionInputs(b, live({ settings: { ...settings, schoolFeesOn: true } })).baseMonthlyExpenses).toBe(1100 + 500)
  })

  it('runs: the engine accepts what it builds', () => {
    const out = runProjections(buildProjectionInputs(projectionBaseline(source()), live()))
    expect(out.labels).toHaveLength(20)
    expect(out.base.nwArr).toHaveLength(20)
    expect(out.base.mortArr[19]).toBeLessThan(500_000)
  })
})

describe('helpers', () => {
  it('school lines: only Child 1 and 2', () => {
    expect(isModelledSchoolLine({ cat: 'Children', name: 'School costs: Child 2 (age 9)' })).toBe(true)
    expect(isModelledSchoolLine({ cat: 'Children', name: 'School costs: Child 3 (age 5)' })).toBe(false)
    expect(isModelledSchoolLine({ cat: 'Home', name: 'School costs: Child 1 (age 5)' })).toBe(false)
  })

  it('fee schedule: preset, else the household’s levels, else the default', () => {
    expect(feeScheduleFor('vic|catholic', [])).toBe(EDUCATION_PRESETS['vic|catholic'].schedule)
    expect(feeScheduleFor(null, [{ level: 'Prep', tuition: 1, fixed: 2 }])).toEqual({ Prep: { tuition: 1, fixed: 2 } })
    expect(feeScheduleFor(null, [])).toBe(SF_BASE)
  })

  it('retirement goal: saved, unless a placeholder; then today’s spending to the nearest $1k', () => {
    expect(retirementIncomeGoal(70_000, 5_000)).toBe(70_000)
    expect(retirementIncomeGoal(80_000, 5_040)).toBe(60_000)
    expect(retirementIncomeGoal(0, 4_000)).toBe(48_000)
  })

  it('spending in retirement leaves out the home loan and the children', () => {
    const b = projectionBaseline(source({ expenses: [...source().expenses, { id: 5, cat: 'Children', name: 'Sport', freq: 'monthly', amt: 200 }] }))
    expect(b.retirementMonthly).toBe(1000 + 100)
    expect(spendingInRetirement({ monthlyExpenses: 5000, catMonthly: { Children: 1500 } }, [])).toBe(3500)
  })
})
