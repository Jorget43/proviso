import { describe, it, expect } from 'vitest'
import { runSuperProjection, runHouseholdProjection } from '@/lib/super'
import { makeSuperInputs, makeHouseholdInputs, makeContext, FX_YEAR } from './fixtures/super'

describe('runSuperProjection — Sp1 one accumulation year (flagship pinned value)', () => {
  const r = runSuperProjection(makeSuperInputs())

  it('matches the hand-derived balance', () => {
    // earnings 100000*0.06=6000; earningsTax 6000*0.15=900
    // gross 100000*0.12=12000; cap(n=0)=30000 → contribution=12000, contributionTax=12000*0.15=1800
    // fees 100000*0.005=500
    // balance = 100000 + 6000 - 900 + 12000 - 1800 - 500 = 114800
    expect(r.retirementBalance).toBe(114800)
  })

  it('the single accumulation row is non-cap, non-div293, at the injected startYear', () => {
    // r.rows also includes the (always-run) drawdown phase — filter to accumulation only.
    const accumulation = r.rows.filter(row => row.phase === 'accumulation')
    expect(accumulation).toHaveLength(1)
    expect(r.rows[0].year).toBe(FX_YEAR)
    expect(r.rows[0].phase).toBe('accumulation')
    expect(r.rows[0].capHit).toBe(false)
    expect(r.rows[0].div293).toBe(false)
  })
})

describe('runSuperProjection — Sp2 the concessional cap ladder', () => {
  // additionalContribs is huge so contribution always equals the cap — this
  // exercises lib/superHistory.ts's legislativeCap() through the public API.
  //
  // BEFORE the Phase 15 reconciliation, super.ts kept its own private,
  // calendar-year-keyed AWOTE estimate (round-to-nearest-$2500) that produced
  // [30000, 30000, 32500, 32500, 35000, 35000, 37500] for this fixture — and
  // disagreed with lib/superHistory.ts's FY-ending-keyed legislated table
  // from FY2026-27 onward. AFTER reconciliation, both consumers share one
  // FY-ending-keyed table (legislated where known, floor-rounded AWOTE
  // extrapolation beyond it — matching the ATO's published round-DOWN rule).
  // The fixture's startFyEnding=2027 already has a legislated entry
  // ($32,500), which is why n=0 differs from the old formula's $30,000.
  const r = runSuperProjection(makeSuperInputs({
    currentAge: 40, retirementAge: 47, additionalContribs: 500_000,
  }))

  it('is keyed on legislativeCap(startFyEnding + n), not a private AWOTE estimate', () => {
    const contributions = r.rows.filter(row => row.phase === 'accumulation').map(row => row.contribution)
    // FY2027 (n=0) and FY2028 (n=1) both floor to 32500; FY2029 (n=2) still
    // 32500; FY2030-31 (n=3,4) floor to 35000; FY2032-33 (n=5,6) to 37500.
    expect(contributions).toEqual([32500, 32500, 32500, 35000, 35000, 37500, 37500])
  })

  it('flags capHit on every accumulation row (gross far exceeds the cap)', () => {
    expect(r.rows.filter(row => row.phase === 'accumulation').every(row => row.capHit)).toBe(true)
  })
})

describe('runSuperProjection — Sp3 Division 293 boundary (strict >)', () => {
  it('does not apply Div293 tax exactly at the threshold', () => {
    const r = runSuperProjection(makeSuperInputs({ salaryExcSuper: 250_000, currentAge: 40, retirementAge: 41 }))
    expect(r.rows[0].div293).toBe(false)
    expect(r.rows[0].contributionTax).toBeCloseTo(r.rows[0].contribution * 0.15, 6)
  })

  it('applies Div293 tax one dollar above the threshold', () => {
    const r = runSuperProjection(makeSuperInputs({ salaryExcSuper: 250_001, currentAge: 40, retirementAge: 41 }))
    expect(r.rows[0].div293).toBe(true)
    expect(r.rows[0].contributionTax).toBeCloseTo(r.rows[0].contribution * 0.30, 6)
  })
})

describe('runSuperProjection — Sp4 drawdown and depletion', () => {
  // 0 accumulation years (currentAge===retirementAge); small balance, income
  // large enough relative to it that the balance depletes on the 2nd drawdown year.
  const r = runSuperProjection(makeSuperInputs({
    currentAge: 65, retirementAge: 65, currentBalance: 50_000, desiredRetirementIncome: 40_000,
  }))

  it('depletes and reports the correct age (characterizes the age+1 convention at super.ts:179)', () => {
    // age65: 50000+3000-250-40000=12750 (not negative yet)
    // age66: 12750+765-63.75-40000=-26548.75 (negative) → depletionAge = age+1 = 67
    expect(r.depletionAge).toBe(67)
    expect(r.yearsOfIncome).toBe(2) // 67 - 65
  })

  it('the loop stops at the depleting row — balance floors at 0, no rows past it', () => {
    expect(r.rows).toHaveLength(2)
    expect(r.rows[r.rows.length - 1].balance).toBe(0)
  })

  it('drawdown rows have zero earningsTax/contribution/capHit', () => {
    for (const row of r.rows) {
      expect(row.phase).toBe('drawdown')
      expect(row.earningsTax).toBe(0)
      expect(row.contribution).toBe(0)
      expect(row.contributionTax).toBe(0)
      expect(row.capHit).toBe(false)
    }
  })
})

describe('runSuperProjection — Sp4b no depletion', () => {
  it('runs the full drawdown range to age 99 when the balance never depletes', () => {
    const r = runSuperProjection(makeSuperInputs({
      currentAge: 67, retirementAge: 67, currentBalance: 2_000_000, desiredRetirementIncome: 10_000,
    }))
    expect(r.depletionAge).toBeNull()
    expect(r.yearsOfIncome).toBeNull()
    expect(r.rows[r.rows.length - 1].age).toBe(99)
  })
})

describe('runSuperProjection — Sp5 present value', () => {
  it('presentValue === balance for every row when inflationRate is 0', () => {
    const r = runSuperProjection(makeSuperInputs({ currentAge: 60, retirementAge: 62, inflationRate: 0 }))
    for (const row of r.rows) expect(row.presentValue).toBeCloseTo(row.balance, 6)
  })

  it('characterizes the accumulation(n+1)/drawdown(n) exponent split at the phase join: retirementBalancePV matches the last accumulation row\'s presentValue', () => {
    const r = runSuperProjection(makeSuperInputs({ currentAge: 40, retirementAge: 42, inflationRate: 0.04 }))
    const lastAccumulation = [...r.rows].reverse().find(row => row.phase === 'accumulation')!
    expect(r.retirementBalancePV).toBeCloseTo(lastAccumulation.presentValue, 6)
  })
})

describe('runHouseholdProjection — Sp6 partner disabled', () => {
  const inputs = makeHouseholdInputs({ partnerEnabled: false, desiredRetirementIncome: 80_000 })
  const ctx = makeContext()
  const r = runHouseholdProjection(inputs, ctx)

  it('person2 is null and combined tracks person1 balance 1:1', () => {
    expect(r.person2).toBeNull()
    r.combined.forEach((c, i) => {
      expect(c.total).toBe(r.person1.rows[i].balance)
      expect(c.person2Age).toBe(ctx.person2Age + (c.year - (ctx.startYear as number)))
    })
  })

  it('person1 is funded at the full household goal (not halved)', () => {
    expect(r.monthlyIncomeGoal).toBeCloseTo(80_000 / 12, 6)
    const firstDrawdown = r.person1.rows.find(row => row.phase === 'drawdown')!
    expect(firstDrawdown.drawdown).toBeCloseTo(80_000, 6) // n=0 → mult=1 regardless of inflationRate
  })
})

describe('runHouseholdProjection — Sp7 partner enabled, different retirement ages', () => {
  const inputs = makeHouseholdInputs({
    partnerEnabled: true, desiredRetirementIncome: 80_000,
    person1RetirementAge: 60, person2RetirementAge: 67,
  })
  const ctx = makeContext({ person1Age: 40, person2Age: 40 })
  const r = runHouseholdProjection(inputs, ctx)

  it('each person is funded at half the household goal', () => {
    const p1FirstDrawdown = r.person1.rows.find(row => row.phase === 'drawdown')!
    const p2FirstDrawdown = r.person2!.rows.find(row => row.phase === 'drawdown')!
    expect(p1FirstDrawdown.drawdown).toBeCloseTo(40_000, 6)
    expect(p2FirstDrawdown.drawdown).toBeCloseTo(40_000, 6)
  })

  it('combined years are sorted and unique, and total is the sum of both balances', () => {
    const years = r.combined.map(c => c.year)
    expect(years).toEqual([...new Set(years)].sort((a, b) => a - b))
    r.combined.forEach(c => expect(c.total).toBeCloseTo(c.person1Balance + c.person2Balance, 6))
  })

  it('combinedRetirementTotal is taken at the LATER of the two retirement years (person2, age 67)', () => {
    const laterYear = FX_YEAR + (67 - 40) // person2 retires later than person1 (age 60)
    const row = r.combined.find(c => c.year === laterYear)!
    expect(r.combinedRetirementTotal).toBeCloseTo(row.total, 6)
    // Sanity: this is NOT the same figure as person1's own retirement year
    const earlierYear = FX_YEAR + (60 - 40)
    const earlierRow = r.combined.find(c => c.year === earlierYear)!
    expect(r.combinedRetirementTotal).not.toBeCloseTo(earlierRow.total, 0)
  })
})

describe('runHouseholdProjection — Sp8 startYear injection', () => {
  it('uses the injected startYear for row labelling', () => {
    const r = runHouseholdProjection(
      makeHouseholdInputs({ partnerEnabled: false }),
      makeContext({ startYear: 2030 }),
    )
    expect(r.person1.rows[0].year).toBe(2030)
  })

  it('falls back to the wall-clock year when omitted', () => {
    const { startYear: _drop, ...ctxWithoutStartYear } = makeContext()
    const r = runHouseholdProjection(makeHouseholdInputs({ partnerEnabled: false }), ctxWithoutStartYear)
    expect(r.person1.rows[0].year).toBe(new Date().getFullYear())
  })
})
