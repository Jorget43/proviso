'use client'
import { fmt } from '@/lib/formatting'
import { computeChildcare } from '@/lib/childcare'
import Panel from '@/components/ui/Panel'

export interface ChildcareSettings {
  id:          number
  enabled:     boolean
  costPerDay:  number
  daysPerWeek: number
  numChildren: number
}

interface Props {
  settings:     ChildcareSettings
  familyIncome: number
  onUpdate:     (patch: Partial<ChildcareSettings>) => void
}

export default function ChildcarePanel({ settings, familyIncome, onUpdate }: Props) {
  const { enabled, costPerDay, daysPerWeek, numChildren } = settings
  const r = computeChildcare({ costPerDay, daysPerWeek, numChildren, familyIncome })

  return (
    <Panel title="Childcare & subsidy (CCS)" dotColor="var(--pink)">
      <div className="ob-toggle-row" style={{ marginBottom: enabled ? 12 : 0 }}>
        <div>
          <div className="ob-field-label">We pay for childcare</div>
          <div className="ob-field-hint">Auto-calculates your out-of-pocket cost after CCS and writes it to the Childcare budget line.</div>
        </div>
        <label className="toggle-switch">
          <input type="checkbox" checked={enabled} onChange={e => onUpdate({ enabled: e.target.checked })} />
          <span className="toggle-slider" />
        </label>
      </div>

      {enabled && (
        <>
          <div className="da-grid" style={{ marginBottom: 12 }}>
            <div className="da-row">
              <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Cost per day (per child, before subsidy)</label>
              <div className="input-prefix" style={{ width: 120 }}>
                <span>$</span>
                <input
                  type="number"
                  defaultValue={costPerDay}
                  key={`cpd-${costPerDay}`}
                  onBlur={e => onUpdate({ costPerDay: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="da-row">
              <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Days per week (per child)</label>
              <input
                className="da-input wide"
                type="number"
                min="0"
                max="7"
                defaultValue={daysPerWeek}
                key={`dpw-${daysPerWeek}`}
                onBlur={e => onUpdate({ daysPerWeek: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="da-row">
              <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Children in care</label>
              <input
                className="da-input wide"
                type="number"
                min="0"
                max="6"
                defaultValue={numChildren}
                key={`nc-${numChildren}`}
                onBlur={e => onUpdate({ numChildren: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.74rem' }}>
            <Row label={`CCS rate (family income ${fmt(familyIncome)})`} value={`${r.standardRate}%`} />
            {numChildren > 1 && r.higherRate !== r.standardRate && (
              <Row label="Higher rate (younger children)" value={`${r.higherRate}%`} valueColor="var(--teal)" />
            )}
            <Row label="Gross fees" value={`${fmt(r.grossWeekly)}/wk`} />
            <Row label="Subsidy" value={`−${fmt(r.subsidyWeekly)}/wk`} valueColor="var(--green)" />
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
              <Row label="Out of pocket → Childcare line" value={`${fmt(r.netMonthly)}/mo`} bold valueColor="var(--pink)" />
            </div>
            {r.capApplied && (
              <div style={{ color: 'var(--amber)', fontSize: '0.68rem', marginTop: 2 }}>
                Daily fee exceeds the subsidised hourly cap — the amount above the cap isn&rsquo;t subsidised.
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  )
}

function Row({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--t2)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 600 : 500, color: valueColor }}>{value}</span>
    </div>
  )
}
