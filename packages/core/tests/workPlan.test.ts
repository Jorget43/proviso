import { describe, it, expect } from 'vitest'
import { workBlocks, newWorkChange, newLeave, newLeaveStep, whenLabel, sortByStart } from '../src/workPlan'

const phases = [
  { year: 2028, month: 2, days: 3 },
  { year: 2026, days: 5 },
  { year: 2027, month: 7, days: 0 },
  { year: 2028, month: 8, days: 4 },
]

describe('work plan', () => {
  it('sorts by month and names it', () => {
    expect(sortByStart(phases).map(whenLabel)).toEqual(['January 2026', 'July 2027', 'February 2028', 'August 2028'])
  })

  it('groups a leave with the steps back to work', () => {
    const b = workBlocks(phases, true)
    expect(b.map(x => x.kind)).toEqual(['change', 'leave'])
    expect(b[1]).toMatchObject({ leave: { year: 2027, month: 7 }, steps: [{ days: 3 }, { days: 4 }] })
    // Without parental leave, 0 days is just a change (not working).
    expect(workBlocks(phases, false).map(x => x.kind)).toEqual(['change', 'change', 'change', 'change'])
  })

  it('a first change also records full-time from now', () => {
    expect(newWorkChange([], 2026)).toEqual([{ year: 2026, month: 1, days: 5 }, { year: 2027, month: 1, days: 4 }])
    expect(newWorkChange(phases, 2026)).toEqual([{ year: 2029, month: 8, days: 3 }])
    expect(newLeave([], 2026)).toEqual([{ year: 2026, month: 1, days: 5 }, { year: 2027, month: 7, days: 0 }, { year: 2028, month: 1, days: 3 }])
  })

  it('steps back up a day each six months', () => {
    const [, leave] = workBlocks(phases, true)
    if (leave.kind !== 'leave') throw new Error('expected a leave')
    expect(newLeaveStep(leave)).toEqual({ year: 2029, month: 2, days: 5 })
    expect(newLeaveStep({ leave: leave.leave, steps: [] })).toEqual({ year: 2028, month: 1, days: 3 })
  })
})
