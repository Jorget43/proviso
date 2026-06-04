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
  jorgeFTE: number
  graceFTE: number
  graceHasHELP: boolean
  taxMode: boolean
  jorgeMonthlyNet: number
  graceMonthlyNet: number
}

interface IncomePanelProps {
  income: IncomeSettings
  currentDays: number
  jorgeNet: number
  graceNet: number
  onUpdate: (patch: Partial<IncomeSettings>) => void
}

export default function IncomePanel({ income, currentDays, jorgeNet, graceNet, onUpdate }: IncomePanelProps) {
  const graceWorking = income.graceFTE * (currentDays / 5)
  const gracePct = Math.round(currentDays / 5 * 100)

  const toggle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--t2)' }}>
      ATO brackets
      <label className="toggle-switch">
        <input type="checkbox" checked={income.taxMode}
          onChange={e => onUpdate({ taxMode: e.target.checked })} />
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
          <div className="inc-person">
            <label>Person2 <span style={{ color: 'var(--pink)', fontWeight: 500, fontSize: '0.7rem' }}>{currentDays}d/wk</span></label>
            <div className="input-prefix">
              <span>FTE/yr</span>
              <input
                type="number"
                defaultValue={income.graceFTE}
                onBlur={e => onUpdate({ graceFTE: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--teal)', fontWeight: 500, marginTop: 3 }}>
              {currentDays}d/wk = {fmt(graceWorking)}/yr gross ({gracePct}% FTE)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <input
                type="checkbox"
                id="graceHELPchk"
                checked={income.graceHasHELP}
                onChange={e => onUpdate({ graceHasHELP: e.target.checked })}
              />
              <label htmlFor="graceHELPchk" style={{ fontSize: '0.68rem', color: 'var(--t2)', cursor: 'pointer' }}>
                HELP debt repayments
              </label>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: 2 }}>
              {fmt(graceWorking)}/yr gross &rarr; {fmt(graceNet * 12)}/yr net ({fmt(graceNet)}/mo)
              {income.graceHasHELP && calcHELPRepayment(graceWorking) > 0 &&
                ` · HELP ${fmt(calcHELPRepayment(graceWorking))}/yr`}
            </div>
          </div>
          <div className="inc-person">
            <label>Person1</label>
            <div className="input-prefix">
              <span>Gross/yr</span>
              <input
                type="number"
                defaultValue={income.jorgeFTE}
                onBlur={e => onUpdate({ jorgeFTE: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: 4 }}>No HELP debt</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: 2 }}>
              {fmt(income.jorgeFTE)}/yr gross &rarr; {fmt(jorgeNet * 12)}/yr net ({fmt(jorgeNet)}/mo)
            </div>
          </div>
        </div>
      ) : (
        <div className="income-grid">
          <div className="inc-person">
            <label>Person2 <span style={{ color: 'var(--pink)', fontWeight: 500, fontSize: '0.7rem' }}>{currentDays}d/wk</span></label>
            <div className="input-prefix">
              <span>$/mo net</span>
              <input
                type="number"
                defaultValue={income.graceMonthlyNet}
                onBlur={e => onUpdate({ graceMonthlyNet: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="inc-person">
            <label>Person1</label>
            <div className="input-prefix">
              <span>$/mo net</span>
              <input
                type="number"
                defaultValue={income.jorgeMonthlyNet}
                onBlur={e => onUpdate({ jorgeMonthlyNet: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      )}

      {income.taxMode && (
        <TaxBreakdown income={income} currentDays={currentDays} />
      )}
    </Panel>
  )
}

function TaxBreakdown({ income, currentDays }: { income: IncomeSettings; currentDays: number }) {
  const graceWorking = income.graceFTE * (currentDays / 5)
  const rows = [
    { name: `Person2 (${currentDays}d/wk · ${Math.round(currentDays/5*100)}% FTE)`, gross: graceWorking, hasHELP: income.graceHasHELP },
    { name: 'Person1', gross: income.jorgeFTE, hasHELP: false },
  ].filter(r => r.gross > 0)

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.75rem' }}>
      {rows.map(r => {
        const tax  = calcIncomeTax(r.gross)
        const med  = calcMedicare(r.gross)
        const help = r.hasHELP ? calcHELPRepayment(r.gross) : 0
        const net  = calcAfterTax(r.gross, r.hasHELP)
        const eff  = effectiveRate(r.gross, r.hasHELP) * 100
        const marg = marginalRate(r.gross) * 100
        return (
          <div key={r.name} style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.74rem',
          }}>
            <span style={{ minWidth: 180, fontWeight: 500, color: 'var(--t1)' }}>{r.name}</span>
            <span style={{ color: 'var(--t3)' }}>Gross <strong style={{ color: 'var(--t1)' }}>{fmt(r.gross)}</strong></span>
            <span style={{ color: 'var(--t3)' }}>Tax <strong style={{ color: 'var(--red)' }}>{fmt(tax)}</strong></span>
            <span style={{ color: 'var(--t3)' }}>Medicare <strong style={{ color: 'var(--red)' }}>{fmt(med)}</strong></span>
            {r.hasHELP && help > 0 && (
              <span style={{ color: 'var(--t3)' }}>HELP <strong style={{ color: 'var(--amber)' }}>{fmt(help)}</strong></span>
            )}
            <span style={{ color: 'var(--t3)' }}>Net <strong style={{ color: 'var(--green)' }}>{fmt(net)}</strong></span>
            <span style={{ color: 'var(--t3)' }}>Eff. rate <strong style={{ color: 'var(--t1)' }}>{eff.toFixed(1)}%</strong></span>
            <span style={{ color: 'var(--t3)' }}>Marginal <strong style={{ color: 'var(--amber)' }}>{marg.toFixed(1)}%</strong></span>
          </div>
        )
      })}
      <p style={{ fontSize: '0.66rem', color: 'var(--t3)', marginTop: 4, lineHeight: 1.5 }}>
        2024-25 ATO brackets · Medicare levy 2% · LITO applied · Bracket creep modelled in projections
      </p>
    </div>
  )
}
