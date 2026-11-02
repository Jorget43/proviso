// How a person's work changes are shown and added, the same in both apps
// (NAS What if? → Work, the app's What if? → Work). The changes themselves
// are WorkPhase rows (projections.ts): from a month of a year, so many days
// a week; 0 days is parental leave for the partner when that's switched on,
// otherwise not working.

import type { WorkPhase } from './projections'

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

/** Months from year 0, so changes compare by month. */
export const monthKey = (p: { year: number; month?: number | null }) => p.year * 12 + (p.month ?? 1) - 1
export const fromMonthKey = (k: number) => ({ year: Math.floor(k / 12), month: (k % 12) + 1 })
/** "July 2027". */
export const whenLabel = (p: { year: number; month?: number | null }) => `${MONTH_NAMES[(p.month ?? 1) - 1]} ${p.year}`

export const sortByStart = <P extends WorkPhase>(phases: P[]): P[] => [...phases].sort((a, b) => monthKey(a) - monthKey(b))

export type WorkBlock<P extends WorkPhase> =
  | { kind: 'change'; phase: P }
  /** A stretch of parental leave: the leave, then the return and steps back up (up to the next leave). */
  | { kind: 'leave'; leave: P; steps: P[] }

/** The changes grouped for showing: plain changes, and each leave with its steps back to work. */
export function workBlocks<P extends WorkPhase>(phases: P[], leaveOn: boolean): WorkBlock<P>[] {
  const blocks: WorkBlock<P>[] = []
  for (const p of sortByStart(phases)) {
    const open = blocks[blocks.length - 1]
    if (leaveOn && p.days === 0) blocks.push({ kind: 'leave', leave: p, steps: [] })
    else if (open?.kind === 'leave' && p.days > 0) open.steps.push(p)
    else blocks.push({ kind: 'change', phase: p })
  }
  return blocks
}

type NewPhase = { year: number; month: number; days: number }

// With no changes yet the projection assumes full-time throughout, and the
// earliest change also covers the years before it, so a first change would
// reach back to today: "full-time from now" is recorded with it.
const withStart = (phases: WorkPhase[], currentYear: number, rows: NewPhase[]): NewPhase[] =>
  phases.length ? rows : [{ year: currentYear, month: 1, days: 5 }, ...rows]

/** A new change a year after the last one, one day fewer (going part-time is the usual reason). */
export function newWorkChange(phases: WorkPhase[], currentYear: number): NewPhase[] {
  const last = sortByStart(phases).at(-1)
  const when = last ? fromMonthKey(monthKey(last) + 12) : { year: currentYear + 1, month: 1 }
  const days = last && last.days > 0 ? Math.max(1, last.days - (last.days > 1 ? 1 : 0)) : 4
  return withStart(phases, currentYear, [{ ...when, days }])
}

/** Parental leave from July next year (or after the last change), back at 3 days the January after. */
export function newLeave(phases: WorkPhase[], currentYear: number): NewPhase[] {
  const last = sortByStart(phases).at(-1)
  const start = Math.max(currentYear + 1, last ? last.year + 1 : currentYear + 1)
  return withStart(phases, currentYear, [{ year: start, month: 7, days: 0 }, { year: start + 1, month: 1, days: 3 }])
}

/** The next step back from leave: the return (a year on, 3 days), then a day more each six months. */
export function newLeaveStep(block: { leave: WorkPhase; steps: WorkPhase[] }): NewPhase {
  const last = block.steps.at(-1)
  if (!last) return { ...fromMonthKey(monthKey(block.leave) + 6), days: 3 }
  return { ...fromMonthKey(monthKey(last) + 6), days: Math.min(5, last.days + 1) }
}
