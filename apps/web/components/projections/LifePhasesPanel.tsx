'use client'
import type { LifePhase } from '@proviso/core/lifephases'

// "Extra costs by year": costs the household adds for a run of years, on
// top of what the plan already counts. Children's everyday costs, childcare
// and school fees are modelled (life stages, Family tab), so they don't
// belong here.

const ONGOING = 2100

interface LifePhasesPanelProps {
  phases:   LifePhase[]
  onAdd:    () => void
  onUpdate: (id: number, patch: Partial<LifePhase>) => void
  onDelete: (id: number) => void
}

export default function LifePhasesPanel({ phases, onAdd, onUpdate, onDelete }: LifePhasesPanelProps) {
  const sorted = [...phases].sort((a, b) => a.startYear - b.startYear)
  return (
    <div className="wk">
      <p className="wp-intro">
        Costs on top of your budget for a run of years: caring for a parent, a hobby, a second car. Children&rsquo;s
        everyday costs, childcare and school fees are already counted (Family tab), so leave them out here.
      </p>
      {sorted.length > 0 && (
        <ul className="wk-list">
          {sorted.map(p => (
            <li key={p.id} className={`wk-row${p.enabled ? '' : ' off'}`}>
              <div className="wk-row-head">
                <label className="mix-check">
                  <input type="checkbox" checked={p.enabled} onChange={e => onUpdate(p.id, { enabled: e.target.checked })} />
                  {p.enabled ? 'Counted' : 'Not counted'}
                </label>
                <button type="button" className="wp-remove" onClick={() => onDelete(p.id)} aria-label={`Remove ${p.name}`}>Remove</button>
              </div>
              <div className="wk-fields">
                <label className="wk-field" style={{ flex: '1 1 180px' }}><span>What for</span>
                  <input className="wk-input" defaultValue={p.name} maxLength={60}
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.name) onUpdate(p.id, { name: v }) }} />
                </label>
                <label className="wk-field"><span>A month</span>
                  <span className="input-prefix wk-money"><span>$</span>
                    <input type="number" inputMode="decimal" defaultValue={p.monthlyAmt}
                      onBlur={e => onUpdate(p.id, { monthlyAmt: parseFloat(e.target.value) || 0 })} />
                  </span>
                </label>
                <label className="wk-field"><span>From</span>
                  <input className="wk-input narrow" type="number" inputMode="numeric" defaultValue={p.startYear}
                    onBlur={e => onUpdate(p.id, { startYear: parseInt(e.target.value) || p.startYear })} />
                </label>
                <label className="wk-field"><span>Until (blank: ongoing)</span>
                  <input className="wk-input narrow" type="number" inputMode="numeric" defaultValue={p.endYear >= ONGOING - 10 ? '' : p.endYear}
                    onBlur={e => onUpdate(p.id, { endYear: e.target.value.trim() === '' ? ONGOING : parseInt(e.target.value) || p.endYear })} />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="add-btn" onClick={onAdd}>+ Add a cost</button>
    </div>
  )
}
