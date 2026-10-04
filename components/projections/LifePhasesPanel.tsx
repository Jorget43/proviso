'use client'
import type { LifePhase } from '@/lib/lifephases'

interface LifePhasesPanelProps {
  phases:   LifePhase[]
  onToggle: (id: number, enabled: boolean) => void
}

export default function LifePhasesPanel({ phases, onToggle }: LifePhasesPanelProps) {
  return (
    <>
      <p style={{ fontSize: '0.7rem', color: 'var(--t3)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
        Overlay costs that change over time — baby expenses, activity ramp-up, phase-outs. Toggle rows on/off to see their impact.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {phases.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', padding: '3px 0' }}>
            <label className="toggle-switch" style={{ flexShrink: 0 }}>
              <input type="checkbox" checked={p.enabled} onChange={e => onToggle(p.id, e.target.checked)} />
              <span className="toggle-slider" />
            </label>
            <span style={{ flex: 1, color: p.enabled ? 'var(--t1)' : 'var(--t3)', textDecoration: p.enabled ? 'none' : 'line-through' }}>
              {p.name}
            </span>
            <span style={{ color: 'var(--t3)', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
              {p.startYear}–{p.endYear >= 2090 ? '∞' : p.endYear}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
