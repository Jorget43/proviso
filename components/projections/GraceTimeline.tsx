'use client'
import { GRACE_FTE } from '@/lib/constants'
import { fmt } from '@/lib/formatting'

export interface GracePhaseRow {
  id:   number
  year: number
  days: number
}

interface GraceTimelineProps {
  phases:      GracePhaseRow[]
  currentYear: number
  fte?:        number
  showLeave?:  boolean
  onUpdate:    (id: number, field: string, value: number) => void
  onDelete:    (id: number) => void
  onAdd:       () => void
}

function phaseLabel(days: number, showLeave: boolean): string {
  if (days === 0) return showLeave ? 'Parental leave' : 'Leave'
  if (days === 5) return 'Full time'
  return `${days} days/wk`
}

function phaseIncome(days: number, fte: number, showLeave: boolean): string {
  if (days === 0) return showLeave ? 'PPL (first year)' : 'Unpaid leave'
  return fmt(fte * (days / 5)) + '/yr'
}

export default function GraceTimeline({
  phases, currentYear, fte = GRACE_FTE, showLeave = true, onUpdate, onDelete, onAdd,
}: GraceTimelineProps) {
  const sorted = [...phases].sort((a, b) => a.year - b.year)
  const kStr   = Math.round(fte / 1000)

  return (
    <>
      <div style={{ fontSize: '0.69rem', color: 'var(--t3)', marginBottom: '0.65rem', lineHeight: 1.5 }}>
        FTE base: <strong style={{ color: 'var(--t1)' }}>${fte.toLocaleString()}/yr</strong>
        {' · '}3d=${Math.round(fte * 0.6 / 1000)}k · 4d=${Math.round(fte * 0.8 / 1000)}k · 5d=${kStr}k
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tl-table">
          <thead>
            <tr><th>From</th><th style={{ textAlign: 'center' }}>Days</th><th>Income</th><th>Phase</th><th /></tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isLeave = p.days === 0
              const isCur   = p.year <= currentYear && (i === sorted.length - 1 || sorted[i + 1].year > currentYear)
              return (
                <tr key={p.id} className={isLeave ? 'leave-row' : isCur ? 'current-row' : ''}>
                  <td>
                    <input
                      type="number"
                      defaultValue={p.year}
                      style={{ width: 60, border: 'none', background: 'transparent', fontSize: '0.78rem' }}
                      onBlur={e => onUpdate(p.id, 'year', parseInt(e.target.value) || p.year)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <select
                      defaultValue={p.days}
                      onChange={e => onUpdate(p.id, 'days', parseInt(e.target.value))}
                      style={{ fontSize: '0.76rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                      {(showLeave ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5]).map(d =>
                        <option key={d} value={d}>{d === 0 ? 'Leave' : d + 'd'}</option>
                      )}
                    </select>
                  </td>
                  <td style={{ color: isLeave ? 'var(--pink)' : 'var(--t2)', fontSize: '0.74rem' }}>{phaseIncome(p.days, fte, showLeave)}</td>
                  <td style={{ color: 'var(--t2)', fontSize: '0.74rem' }}>{phaseLabel(p.days, showLeave)}{isCur ? ' ←' : ''}</td>
                  <td>
                    <button
                      onClick={() => onDelete(p.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px' }}
                    >×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button className="add-btn mt1" onClick={onAdd}>+ Add phase</button>
    </>
  )
}
