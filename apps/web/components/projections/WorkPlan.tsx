'use client'
import { PARTNER_FTE, PPL_WEEKS } from '@proviso/core/constants'
import { fmt } from '@proviso/core/formatting'
import { MONTH_NAMES as MONTHS, monthKey as key, whenLabel as when, sortByStart, workBlocks, newWorkChange, newLeave, newLeaveStep } from '@proviso/core/workPlan'

// Someone's work over time, as a short list of changes ("from July 2028,
// 3 days a week"). Each stretch of parental leave is one card holding when
// it starts, when they go back and at how many days, and any steps back up
// to more days. Changes start in a month as well as a year (schema v14).

export interface WorkPhaseRow {
  id:     number
  year:   number
  days:   number
  month?: number
}

export type WorkPatch = Partial<Omit<WorkPhaseRow, 'id'>>

interface Props {
  phases:      WorkPhaseRow[]
  currentYear: number
  fte?:        number
  /** Parental leave is on (the partner): 0 days means leave, and leave can be planned. */
  leaveOn?:    boolean
  onUpdate:    (id: number, patch: WorkPatch) => void
  onDelete:    (ids: number[]) => void
  onAdd:       (rows: Omit<WorkPhaseRow, 'id'>[]) => void
}

const monthOf = (p: { month?: number }) => p.month ?? 1

function daysLabel(days: number, leaveOn: boolean): string {
  if (days === 0) return leaveOn ? 'Parental leave' : 'Not working'
  if (days === 5) return 'Full-time (5 days)'
  return `${days} day${days === 1 ? '' : 's'} a week`
}

/** Month and year a change starts, as two dropdowns. */
function WhenPicker({ p, currentYear, label, onChange }: {
  p: WorkPhaseRow; currentYear: number; label: string; onChange: (patch: WorkPatch) => void
}) {
  const first = Math.min(p.year, currentYear - 1)
  const years = Array.from({ length: currentYear + 46 - first }, (_, i) => first + i)
  return (
    <div className="wk-when" role="group" aria-label={label}>
      <select aria-label={`${label}: month`} value={monthOf(p)} onChange={e => onChange({ month: Number(e.target.value) })}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select aria-label={`${label}: year`} value={p.year} onChange={e => onChange({ year: Number(e.target.value) })}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

function DaysPicker({ p, leaveOn, label, onChange, min = 0 }: {
  p: WorkPhaseRow; leaveOn: boolean; label: string; onChange: (patch: WorkPatch) => void; min?: number
}) {
  return (
    <select className="wk-days" aria-label={label} value={p.days} onChange={e => onChange({ days: Number(e.target.value) })}>
      {[0, 1, 2, 3, 4, 5].filter(d => d >= min).map(d => <option key={d} value={d}>{daysLabel(d, leaveOn)}</option>)}
    </select>
  )
}

export default function WorkPlan({ phases, currentYear, fte = PARTNER_FTE, leaveOn = false, onUpdate, onDelete, onAdd }: Props) {
  const sorted = sortByStart(phases)
  const nowKey = currentYear * 12 + new Date().getMonth()
  const pay = (days: number) => (days > 0 ? `about ${fmt(fte * days / 5)} a year before tax` : leaveOn ? '' : 'no pay')
  const blocks = workBlocks(phases, leaveOn)

  return (
    <div className="wk">
      <p className="wp-intro">Full-time pay is {fmt(fte)} a year.{blocks.length <= 1 ? ' Add a change when the days you work go up or down.' : ''}</p>
      <ol className="wk-list">
        {blocks.map((b, i) => {
          if (b.kind === 'change') {
            const isNow = key(b.phase) <= nowKey && (i === blocks.length - 1 || key(sorted[sorted.indexOf(b.phase) + 1]) > nowKey)
            return (
              <li key={b.phase.id} className={`wk-row${isNow ? ' now' : ''}`}>
                <div className="wk-row-head">
                  <span className="wk-tag">{isNow ? 'Now' : key(b.phase) < nowKey ? 'Earlier' : 'Then'}</span>
                  {sorted.length > 1 && (
                    <button type="button" className="wp-remove" onClick={() => onDelete([b.phase.id])} aria-label={`Remove the change from ${when(b.phase)}`}>Remove</button>
                  )}
                </div>
                <div className="wk-fields">
                  <label className="wk-field"><span>From</span>
                    <WhenPicker p={b.phase} currentYear={currentYear} label="Starts" onChange={patch => onUpdate(b.phase.id, patch)} />
                  </label>
                  <label className="wk-field"><span>Works</span>
                    <DaysPicker p={b.phase} leaveOn={false} min={leaveOn ? 1 : 0} label="Days a week" onChange={patch => onUpdate(b.phase.id, patch)} />
                  </label>
                </div>
                {pay(b.phase.days) && <p className="wp-pay">That&rsquo;s {pay(b.phase.days)}.</p>}
              </li>
            )
          }
          const { leave, steps } = b
          const lastStep = steps[steps.length - 1] ?? leave
          return (
            <li key={leave.id} className="wk-row leave">
              <div className="wk-row-head">
                <span className="wk-tag">Parental leave</span>
                <button type="button" className="wp-remove" onClick={() => onDelete([leave.id, ...steps.map(s => s.id)])}
                  aria-label={`Remove the parental leave from ${when(leave)}`}>Remove</button>
              </div>
              <div className="wk-fields">
                <label className="wk-field"><span>Leave starts</span>
                  <WhenPicker p={leave} currentYear={currentYear} label="Leave starts" onChange={patch => onUpdate(leave.id, patch)} />
                </label>
              </div>
              <p className="wp-pay">Parental Leave Pay: {PPL_WEEKS} weeks at the national minimum wage, paid from when leave starts.</p>
              {steps.length === 0 && <p className="wp-pay warn">No return to work set yet.</p>}
              {steps.map((s, k) => (
                <div key={s.id} className="wk-step">
                  <div className="wk-fields">
                    <label className="wk-field"><span>{k === 0 ? 'Back at work from' : 'Then from'}</span>
                      <WhenPicker p={s} currentYear={currentYear} label={k === 0 ? 'Back at work' : 'Step up'} onChange={patch => onUpdate(s.id, patch)} />
                    </label>
                    <label className="wk-field"><span>Works</span>
                      <DaysPicker p={s} leaveOn={false} min={1} label="Days a week" onChange={patch => onUpdate(s.id, patch)} />
                    </label>
                    {k > 0 && <button type="button" className="wp-remove" onClick={() => onDelete([s.id])} aria-label={`Remove the step from ${when(s)}`}>Remove</button>}
                  </div>
                  <p className="wp-pay">That&rsquo;s {pay(s.days)}.</p>
                </div>
              ))}
              {lastStep.days < 5 && (
                <button type="button" className="add-btn" onClick={() => onAdd([newLeaveStep(b)])}>
                  {steps.length ? '+ Add a step back up (more days)' : '+ Add the return to work'}
                </button>
              )}
            </li>
          )
        })}
      </ol>
      <div className="wk-actions">
        <button type="button" className="add-btn" onClick={() => onAdd(newWorkChange(phases, currentYear))}>
          + Add a change (for example, going part-time)
        </button>
        {leaveOn && (
          <button type="button" className="add-btn" onClick={() => onAdd(newLeave(phases, currentYear))}>+ Plan parental leave</button>
        )}
      </div>
    </div>
  )
}
