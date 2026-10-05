'use client'
import { useState } from 'react'
import {
  calcIncomeTax,
  calcMedicare,
  calcHELPRepayment,
  marginalRate,
  TAX_THRESHOLDS,
  TAX_RATES,
} from '@/lib/tax'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

export interface IncomeSettings {
  id: number
  person1FTE: number
  person2FTE: number
  person1HasHELP: boolean
  person2HasHELP: boolean
  taxMode: boolean
  person1MonthlyNet: number
  person2MonthlyNet: number
}

interface IncomePanelProps {
  income: IncomeSettings
  person1Days: number
  person2Days: number
  partnerEnabled: boolean
  onUpdate: (patch: Partial<IncomeSettings>) => void
  person1Name: string
  person2Name: string
  person1Net: number   // monthly take-home, as the Budget computes it
  person2Net: number
}

// Visual ceiling for the bracket bar — the Div 293 threshold.
const DISPLAY_MAX = 250000
const BRACKET_COLORS = ['var(--green)', '#C8A830', 'var(--amber)', '#C05C35', 'var(--red)']
// Derived from the canonical ATO brackets in lib/tax.ts (tracked by the
// assumptions watchdog) so the display never drifts from the tax engine.
const BRACKETS = TAX_THRESHOLDS.map((lo, i) => ({
  lo,
  hi: TAX_THRESHOLDS[i + 1] ?? DISPLAY_MAX,
  label: TAX_RATES[i] === 0 ? 'Nil' : `${Math.round(TAX_RATES[i] * 100)}%`,
  color: BRACKET_COLORS[i],
}))

function BracketBar({ gross }: { gross: number }) {
  const capped = Math.min(gross, DISPLAY_MAX)
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--t3)', marginBottom: 4 }}>
        Income bracket position
      </div>
      <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {BRACKETS.map(b => {
          const pct = (b.hi - b.lo) / DISPLAY_MAX * 100
          const fill = capped >= b.hi ? 100 : capped > b.lo ? (capped - b.lo) / (b.hi - b.lo) * 100 : 0
          return (
            <div
              key={b.lo}
              title={`${b.label}: $${(b.lo / 1000).toFixed(0)}k – $${(b.hi / 1000).toFixed(0)}k`}
              style={{
                flex: `0 0 ${pct}%`,
                background: 'rgba(50,42,28,0.08)',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${fill}%`,
                  height: '100%',
                  background: b.color,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', marginTop: 3 }}>
        {BRACKETS.map(b => {
          const pct = (b.hi - b.lo) / DISPLAY_MAX * 100
          const active = capped > b.lo
          return (
            <div
              key={b.lo}
              style={{
                flex: `0 0 ${pct}%`,
                fontSize: '0.58rem',
                color: active ? b.color : 'rgba(50,42,28,0.25)',
                textAlign: 'center',
                fontWeight: active ? 600 : 400,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {b.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PersonCard({
  name,
  gross,
  hasHELP,
  nameColor,
  children,
}: {
  name: string
  gross: number
  hasHELP: boolean
  nameColor: string
  children: React.ReactNode
}) {
  const tax  = calcIncomeTax(gross)
  const med  = calcMedicare(gross)
  const help = hasHELP ? calcHELPRepayment(gross) : 0
  const sg   = Math.round(gross * 0.12)
  const net  = gross - tax - med - help
  const eff  = gross > 0 ? ((tax + med + help) / gross * 100) : 0
  const marg = marginalRate(gross) * 100

  return (
    <div className="inc-person-card">
      <div className="inc-card-name" style={{ color: nameColor }}>{name}</div>
      {children}
      {gross > 0 && (
        <>
          <div className="inc-breakdown">
            <div className="inc-br-row">
              <span>Income tax</span>
              <strong className="inc-br-negative">−{fmt(tax)}/yr</strong>
            </div>
            <div className="inc-br-row">
              <span>Medicare levy</span>
              <strong className="inc-br-negative">−{fmt(med)}/yr</strong>
            </div>
            {help > 0 && (
              <div className="inc-br-row">
                <span>HELP repayment</span>
                <strong className="inc-br-help">−{fmt(help)}/yr</strong>
              </div>
            )}
            <div className="inc-br-row inc-br-super-row">
              <span>Super (SG 12%)</span>
              <strong className="inc-br-super">{fmt(sg)}/yr</strong>
            </div>
            <div className="inc-br-row inc-br-net-row">
              <span>Net take-home</span>
              <strong className="inc-br-net">{fmt(net)}/yr · {fmt(net / 12)}/mo</strong>
            </div>
          </div>
          <BracketBar gross={gross} />
          <div className="inc-rates">
            <span>Effective rate: {eff.toFixed(1)}%</span>
            <span>Marginal: {marg.toFixed(0)}%</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function IncomePanel({ income, person1Days, person2Days, partnerEnabled, onUpdate, person1Name, person2Name, person1Net, person2Net }: IncomePanelProps) {
  // Folded to a one-line summary once income is set, so the budget itself is
  // what you see first; open straight away when there's nothing entered yet.
  const [open, setOpen] = useState(person1Net + person2Net <= 0)

  if (!open) {
    const nets = [
      { name: person1Name, net: person1Net, days: person1Days },
      ...(partnerEnabled ? [{ name: person2Name, net: person2Net, days: person2Days }] : []),
    ]
    return (
      <Panel title="Income" dotColor="var(--green)" right={
        <button type="button" className="panel-action" onClick={() => setOpen(true)}>Edit</button>
      }>
        <div className="inc-summary">
          {nets.map(p => (
            <div key={p.name} className="inc-summary-row">
              <span>{p.name}{p.days !== 5 && <small> · {p.days} days a week</small>}</span>
              <strong>{fmt(p.net)}<small>/mo</small></strong>
            </div>
          ))}
          <div className="inc-summary-note">Take-home pay, after tax{income.taxMode ? ' (worked out for you)' : ''}</div>
        </div>
      </Panel>
    )
  }

  const toggle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--t2)' }}>
      Work out tax for me
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={income.taxMode}
          onChange={e => onUpdate({ taxMode: e.target.checked })}
        />
        <span className="toggle-slider" />
      </label>
      <span style={{ color: income.taxMode ? 'var(--teal)' : 'var(--t3)', fontWeight: 500 }}>
        {income.taxMode ? 'On' : 'Off'}
      </span>
      <button type="button" className="panel-action" onClick={() => setOpen(false)}>Done</button>
    </div>
  )

  const people = [
    { key: 'person1' as const, name: person1Name, color: 'var(--blue)', days: person1Days,
      fte: income.person1FTE, hasHELP: income.person1HasHELP, monthlyNet: income.person1MonthlyNet },
    ...(partnerEnabled ? [
      { key: 'person2' as const, name: person2Name, color: 'var(--pink)', days: person2Days,
        fte: income.person2FTE, hasHELP: income.person2HasHELP, monthlyNet: income.person2MonthlyNet },
    ] : []),
  ]

  return (
    <Panel title="Income" dotColor="var(--green)" right={toggle}>
      {income.taxMode ? (
        <div className="income-grid">
          {people.map(p => {
            const working = p.fte * (p.days / 5)
            return (
              <PersonCard key={p.key} name={p.name} gross={working} hasHELP={p.hasHELP} nameColor={p.color}>
                <div className="input-prefix">
                  <span>Salary</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label={`${p.name}'s full-time salary before tax, per year`}
                    defaultValue={p.fte}
                    onBlur={e => onUpdate({ [`${p.key}FTE`]: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--teal)', fontWeight: 500, marginTop: 3 }}>
                  {p.days === 5
                    ? 'Full-time, before tax, per year'
                    : `Full-time salary · ${p.days} days a week = ${fmt(working)}/yr`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id={`${p.key}HELPchk`}
                    checked={p.hasHELP}
                    onChange={e => onUpdate({ [`${p.key}HasHELP`]: e.target.checked })}
                  />
                  <label htmlFor={`${p.key}HELPchk`} style={{ fontSize: '0.68rem', color: 'var(--t2)', cursor: 'pointer' }}>
                    HELP debt repayments
                  </label>
                </div>
              </PersonCard>
            )
          })}
        </div>
      ) : (
        <div className="income-grid">
          {people.map(p => (
            <div key={p.key} className="inc-person">
              <label>
                {p.name}
                {p.days !== 5 && <span style={{ color: p.color, fontWeight: 500, fontSize: '0.7rem' }}> {p.days}d/wk</span>}
              </label>
              <div className="input-prefix">
                <span>Take-home /mo</span>
                <input
                  type="number"
                  inputMode="decimal"
                  defaultValue={p.monthlyNet}
                  onBlur={e => onUpdate({ [`${p.key}MonthlyNet`]: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
