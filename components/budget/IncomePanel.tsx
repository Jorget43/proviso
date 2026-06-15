'use client'
import {
  calcIncomeTax,
  calcMedicare,
  calcHELPRepayment,
  calcAfterTax,
  effectiveRate,
  marginalRate,
} from '@/lib/tax'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

export interface IncomeSettings {
  id: number
  person1FTE: number
  person2FTE: number
  person2HasHELP: boolean
  taxMode: boolean
  person1MonthlyNet: number
  person2MonthlyNet: number
}

interface IncomePanelProps {
  income: IncomeSettings
  currentDays: number
  onUpdate: (patch: Partial<IncomeSettings>) => void
  person1Name: string
  person2Name: string
}

const BRACKETS = [
  { lo: 0,      hi: 18200,  label: 'Nil', color: 'var(--green)' },
  { lo: 18200,  hi: 45000,  label: '16%', color: '#C8A830' },
  { lo: 45000,  hi: 135000, label: '30%', color: 'var(--amber)' },
  { lo: 135000, hi: 190000, label: '37%', color: '#C05C35' },
  { lo: 190000, hi: 250000, label: '45%', color: 'var(--red)' },
]
const DISPLAY_MAX = 250000

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

export default function IncomePanel({ income, currentDays, onUpdate, person1Name, person2Name }: IncomePanelProps) {
  const person2Working = income.person2FTE * (currentDays / 5)
  const person2Pct = Math.round(currentDays / 5 * 100)

  const toggle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--t2)' }}>
      ATO brackets
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
    </div>
  )

  return (
    <Panel title="Income" dotColor="var(--green)" right={toggle}>
      {income.taxMode ? (
        <div className="income-grid">
          <PersonCard
            name={person2Name}
            gross={person2Working}
            hasHELP={income.person2HasHELP}
            nameColor="var(--pink)"
          >
            <div className="input-prefix">
              <span>FTE/yr</span>
              <input
                type="number"
                defaultValue={income.person2FTE}
                onBlur={e => onUpdate({ person2FTE: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--teal)', fontWeight: 500, marginTop: 3 }}>
              {currentDays}d/wk = {fmt(person2Working)}/yr ({person2Pct}% FTE)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <input
                type="checkbox"
                id="person2HELPchk"
                checked={income.person2HasHELP}
                onChange={e => onUpdate({ person2HasHELP: e.target.checked })}
              />
              <label htmlFor="person2HELPchk" style={{ fontSize: '0.68rem', color: 'var(--t2)', cursor: 'pointer' }}>
                HELP debt repayments
              </label>
            </div>
          </PersonCard>

          <PersonCard
            name={person1Name}
            gross={income.person1FTE}
            hasHELP={false}
            nameColor="var(--blue)"
          >
            <div className="input-prefix">
              <span>Gross/yr</span>
              <input
                type="number"
                defaultValue={income.person1FTE}
                onBlur={e => onUpdate({ person1FTE: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: 3 }}>
              5d/wk · Full time · No HELP debt
            </div>
          </PersonCard>
        </div>
      ) : (
        <div className="income-grid">
          <div className="inc-person">
            <label>{person2Name} <span style={{ color: 'var(--pink)', fontWeight: 500, fontSize: '0.7rem' }}>{currentDays}d/wk</span></label>
            <div className="input-prefix">
              <span>$/mo net</span>
              <input
                type="number"
                defaultValue={income.person2MonthlyNet}
                onBlur={e => onUpdate({ person2MonthlyNet: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="inc-person">
            <label>{person1Name}</label>
            <div className="input-prefix">
              <span>$/mo net</span>
              <input
                type="number"
                defaultValue={income.person1MonthlyNet}
                onBlur={e => onUpdate({ person1MonthlyNet: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
