'use client'
import { PARTNER_FTE } from '@proviso/core/constants'
import { fmt } from '@proviso/core/formatting'

// Someone's work pattern over time, one card per change: from which year,
// how many days a week, and roughly what that pays. Cards (not a table) so
// each field is a proper, labelled, tappable control on a phone, and wide
// screens simply fit two or three side by side.

export interface WorkPhaseRow {
  id:   number
  year: number
  days: number
}

interface WorkPhaseTimelineProps {
  phases:      WorkPhaseRow[]
  currentYear: number
  fte?:        number
  showLeave?:  boolean
  onUpdate:    (id: number, field: string, value: number) => void
  onDelete:    (id: number) => void
  onAdd:       () => void
}

function phaseLabel(days: number, showLeave: boolean): string {
  if (days === 0) return showLeave ? 'Parental leave' : 'Not working'
  if (days === 5) return 'Full-time'
  return `${days} days a week`
}

function phaseIncome(days: number, fte: number, showLeave: boolean): string {
  if (days === 0) return showLeave ? 'Parental Leave Pay in the first year' : 'No pay'
  return `About ${fmt(fte * (days / 5))} a year before tax`
}

export default function WorkPhaseTimeline({
  phases, currentYear, fte = PARTNER_FTE, showLeave = true, onUpdate, onDelete, onAdd,
}: WorkPhaseTimelineProps) {
  const sorted = [...phases].sort((a, b) => a.year - b.year)
  const dayChoices = showLeave ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5]

  return (
    <div className="wp">
      <p className="wp-intro">Full-time pay is {fmt(fte)} a year. Add a change for each year the days you work go up or down.</p>
      <div className="wp-cards">
        {sorted.map((p, i) => {
          const isCur = p.year <= currentYear && (i === sorted.length - 1 || sorted[i + 1].year > currentYear)
          const tone = p.days === 0 ? 'leave' : isCur ? 'now' : ''
          return (
            <div key={p.id} className={`wp-card ${tone}`}>
              <div className="wp-card-head">
                <strong>{isCur ? 'Now' : `From ${p.year}`}</strong>
                {sorted.length > 1 && (
                  <button type="button" className="wp-remove" onClick={() => onDelete(p.id)} aria-label={`Remove the change from ${p.year}`}>Remove</button>
                )}
              </div>
              <label className="wp-field">
                <span>From the year</span>
                <input type="number" inputMode="numeric" min={currentYear - 50} max={currentYear + 60}
                  key={`y-${p.id}-${p.year}`} defaultValue={p.year}
                  onBlur={e => { const v = parseInt(e.target.value); if (v && v !== p.year) onUpdate(p.id, 'year', v) }} />
              </label>
              <label className="wp-field">
                <span>Days a week</span>
                <select value={p.days} onChange={e => onUpdate(p.id, 'days', parseInt(e.target.value))}>
                  {dayChoices.map(d => <option key={d} value={d}>{phaseLabel(d, showLeave)}</option>)}
                </select>
              </label>
              <p className="wp-pay">{phaseIncome(p.days, fte, showLeave)}</p>
            </div>
          )
        })}
      </div>
      <button type="button" className="add-btn" onClick={onAdd}>+ Add a change (for example, going part-time)</button>
    </div>
  )
}
