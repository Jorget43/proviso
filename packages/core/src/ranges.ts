// Ranges of outcomes (plan item 8a): the projection run three times, with
// investment returns as expected, lower and higher by a spread (default 2
// percentage points), on investments outside super and on super alike.
//
// Easy to read, but it treats bad years as spread evenly, so it understates
// the risk of a crash just before or after retiring (sequence risk). Monte
// Carlo (item 8b) is the step that captures that.

import { runProjections, type ProjectionInputs, type ProjectionOutput, type ProjectionResult } from './projections'

/** Points either side of the expected return, by default. */
export const DEFAULT_RETURN_SPREAD = 2

export interface RangeRuns {
  /** Returns as expected: the plan. */
  mid:  ProjectionOutput
  /** Returns lower by the spread every year. */
  low:  ProjectionOutput
  /** Returns higher by the spread every year. */
  high: ProjectionOutput
  spread: number
}

/** The inputs with every investment return moved by `points` (percentage points). */
export function shiftReturns(inputs: ProjectionInputs, points: number): ProjectionInputs {
  return {
    ...inputs,
    investReturn: inputs.investReturn + points,
    // Super's rates are decimals (projections.ts LifeCourse).
    lifeCourse: inputs.lifeCourse && { ...inputs.lifeCourse, superReturn: inputs.lifeCourse.superReturn + points / 100 },
  }
}

/** The three runs. A spread of 0 (ranges off) runs the plan once and repeats it. */
export function runRange(inputs: ProjectionInputs, spread: number = DEFAULT_RETURN_SPREAD): RangeRuns {
  const mid = runProjections(inputs)
  if (!(spread > 0)) return { mid, low: mid, high: mid, spread: 0 }
  return { mid, low: runProjections(shiftReturns(inputs, -spread)), high: runProjections(shiftReturns(inputs, spread)), spread }
}

/** The run that counts (with school fees when they're on). */
export const mainOf = (o: ProjectionOutput): ProjectionResult => o.withFees ?? o.base

export interface RangeSummary {
  /** Net worth in the last year (super not counted): worse, expected, better. */
  endNetWorth: { low: number; mid: number; high: number }
  /** Person 1's age when money runs short in retirement, in each case (null: it lasts). */
  runsOutAge:  { low: number | null; mid: number | null; high: number | null }
}

/** The headline figures for each case. `person1Age` is this year's age, when there's a life course. */
export function summariseRange(r: RangeRuns, currentYear: number, person1Age: number | null): RangeSummary {
  const end = (o: ProjectionOutput) => { const nw = mainOf(o).nwArr; return nw[nw.length - 1] ?? 0 }
  const short = (o: ProjectionOutput) => {
    const y = mainOf(o).shortfallYr
    return y && person1Age !== null ? person1Age + (y - currentYear) : null
  }
  return {
    endNetWorth: { low: end(r.low), mid: end(r.mid), high: end(r.high) },
    runsOutAge:  { low: short(r.low), mid: short(r.mid), high: short(r.high) },
  }
}
