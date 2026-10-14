import { describe, it, expect } from 'vitest'
import {
  CHILD_STAGES, WORK_COST_MONTHLY, LATE_RETIREMENT_FACTOR, childStageMonthly, childrenInCare, lifeStageYear,
  type LifeStageFacts,
} from '../src/lifeStages'
import { runProjections } from '../src/projections'
import { makeProjectionInputs } from './fixtures/projections'

describe('the figures', () => {
  it('turns NATSEM 2012 weekly costs into 2026 monthly ones', () => {
    // 0–4, metro: 133 × 1.442 × 0.783 × 1.07 × 52/12 = 695.9 → 695 (nearest 5)
    // 15–17, regional: 414 × 1.442 × 0.783 × 0.856 × 52/12 = 1733.0 → 1735
    expect(CHILD_STAGES.map(s => s.metro)).toEqual([695, 1035, 1195, 2165, 3550])
    expect(CHILD_STAGES.map(s => s.regional)).toEqual([555, 830, 955, 1735, 2840])
  })

  it('works out commuting a month', () => {
    // metro: 19.10 × 1.038 × 5 × 48 / 12 = 396.5 → 395; regional: 14.30 × … = 296.9 → 295
    expect(WORK_COST_MONTHLY).toEqual({ metro: 395, regional: 295 })
  })

  it('eases spending from 85 by ASFA’s difference', () => {
    expect(LATE_RETIREMENT_FACTOR.couple).toBeCloseTo(0.931, 3)
    expect(LATE_RETIREMENT_FACTOR.single).toBeCloseTo(0.949, 3)
  })
})

describe('childStageMonthly', () => {
  it('follows the bands and stops when they leave home', () => {
    expect(childStageMonthly(-1, false)).toBe(0)     // not born yet
    expect(childStageMonthly(0, false)).toBe(695)
    expect(childStageMonthly(4, false)).toBe(695)
    expect(childStageMonthly(5, false)).toBe(1035)
    expect(childStageMonthly(17, true)).toBe(1735)
    expect(childStageMonthly(18, false)).toBe(0)     // left at 18 (the default)
    expect(childStageMonthly(18, false, 22)).toBe(3550)
    expect(childStageMonthly(22, false, 22)).toBe(0)
  })
})

describe('childrenInCare', () => {
  it('picks the youngest not yet at school', () => {
    // In 2026: born 2025 (1), 2023 (3), 2020 (6, at school)
    expect(childrenInCare([2020, 2023, 2025], 1, 2026)).toEqual([2025])
    expect(childrenInCare([2020, 2023, 2025], 5, 2026)).toEqual([2025, 2023])
    expect(childrenInCare([2027], 1, 2026)).toEqual([])  // not born yet
  })
})

const facts = (over: Partial<LifeStageFacts> = {}): LifeStageFacts => ({
  childBirthYears: [], leaveHomeAge: 18, regional: false,
  childcareMonthly: 0, childcareChildren: 0, workDaysToday: [5, 5], ...over,
})

describe('lifeStageYear', () => {
  const at = (f: LifeStageFacts, year: number, workDays: [number, number] = [5, 5], allRetired = false) =>
    lifeStageYear(f, { currentYear: 2026, year, workDays, allRetired })

  it('adds only the change from today as a child grows up', () => {
    // Born 2024: age 2 today (695). In 2029 they're 5: (1035 − 695) × 12 = 4,080 a year more.
    expect(at(facts({ childBirthYears: [2024] }), 2029).children).toBe(4080)
    // Still 4 in 2028: no change.
    expect(at(facts({ childBirthYears: [2024] }), 2028).children).toBe(0)
  })

  it('takes their whole cost out once they leave home', () => {
    // Born 2010: 16 today (2165). In 2028 they're 18 and gone: −2165 × 12 = −25,980.
    expect(at(facts({ childBirthYears: [2010] }), 2028).children).toBe(-25980)
    // Staying to 22: at 18 they cost 3550, (3550 − 2165) × 12 = 16,620 more.
    expect(at(facts({ childBirthYears: [2010], leaveHomeAge: 22 }), 2028).children).toBe(16620)
  })

  it('adds a planned baby’s whole cost from birth', () => {
    expect(at(facts({ childBirthYears: [2028] }), 2027).children).toBe(0)
    expect(at(facts({ childBirthYears: [2028] }), 2028).children).toBe(695 * 12)
  })

  it('stops childcare for each child as they start school', () => {
    // $1,200 a month for two in care (born 2022 and 2024): $600 each.
    const f = facts({ childBirthYears: [2022, 2024], childcareMonthly: 1200, childcareChildren: 2 })
    expect(at(f, 2026).childcare).toBe(0)
    expect(at(f, 2027).childcare).toBe(-7200)   // 2022's child is 5
    expect(at(f, 2029).childcare).toBe(-14400)  // both at school
  })

  it('follows work days, and stops once everyone has retired', () => {
    // Person 2 drops to 3 days: −2/5 of 395 × 12 = −1,896.
    expect(at(facts(), 2027, [5, 3]).work).toBeCloseTo(-1896, 6)
    // Both retired: the retirement goal already leaves work costs out.
    expect(at(facts(), 2027, [0, 0], true).work).toBe(0)
  })

  it('once everyone has retired, a child still at home adds their whole cost', () => {
    // The retirement goal leaves children's costs out. Born 2015: 13 in 2028 → 1195.
    expect(at(facts({ childBirthYears: [2015] }), 2028, [0, 0], true).children).toBe(1195 * 12)
  })
})

describe('in the projection', () => {
  // No loan; nothing grows; $60,000 a year out (5,000 × 12).
  const base = (over = {}) => makeProjectionInputs({ mortBalance: 0, cashOnHand: 0, projYears: 6, ...over })

  it('without life stages, nothing changes', () => {
    const r = runProjections(base()).base
    expect(r.stageArr).toEqual([0, 0, 0, 0, 0, 0])
    expect(r.expArr).toEqual([60000, 60000, 60000, 60000, 60000, 60000])
  })

  it('a teenager leaving home lowers spending from that year', () => {
    // Born 2010, 16 in 2026: 17 in 2027 (no change), 18 in 2028 (−25,980).
    const r = runProjections(base({ lifeStages: facts({ childBirthYears: [2010] }) })).base
    expect(r.stageArr).toEqual([0, -25980, -25980, -25980, -25980, -25980])
    expect(r.expArr.slice(0, 2)).toEqual([60000, 34020])
  })

  it('inflates the change with prices', () => {
    // 2.5% a year: 2028 is the second projected year, × 1.025² = 1.050625 → −27,296.
    const r = runProjections(base({ expInfl: 2.5, expInflNear: 2.5, lifeStages: facts({ childBirthYears: [2010] }) })).base
    expect(r.stageArr[1]).toBe(Math.round(-25980 * 1.025 ** 2))
  })

  it('parental leave takes that person’s commuting out for the year', () => {
    const r = runProjections(base({
      person2Phases: [{ year: 2026, days: 5 }, { year: 2028, days: 0 }, { year: 2029, days: 5 }],
      lifeStages: facts(),
    })).base
    // 2028: person 2 at 0 days: −395 × 12 = −4,740.
    expect(r.stageArr.slice(0, 3)).toEqual([0, -4740, 0])
  })
})
