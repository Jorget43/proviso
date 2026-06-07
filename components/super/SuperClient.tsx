'use client'
import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  runHouseholdProjection,
  type HouseholdSuperInputs,
  type ProjectionContext,
} from '@/lib/super'
import SuperBanner from './SuperBanner'
import SuperBalanceChart from './SuperBalanceChart'
import SuperProjectionTable from './SuperProjectionTable'
import Panel from '@/components/ui/Panel'

interface MortgageContext {
  mortgagePaymentMonthly: number
  mortgageEndYear:        number
}

interface Props {
  initial:           HouseholdSuperInputs
  context:           ProjectionContext
  mortgage:          MortgageContext
  budgetAnnualSpend: number
}

type Field = keyof HouseholdSuperInputs

export default function SuperClient({ initial, context, mortgage, budgetAnnualSpend }: Props) {
  const [inputs, setInputs] = useState<HouseholdSuperInputs>(initial)
  const [saving, setSaving]  = useState(false)

  const set = useCallback((field: Field, value: number | boolean) => {
    setInputs(prev => ({ ...prev, [field]: value }))
  }, [])

  const result = useMemo(() => runHouseholdProjection(inputs, context), [inputs, context])

  async function save() {
    setSaving(true)
    await fetch('/api/super-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    })
    setSaving(false)
  }

  // Mortgage hint calculations
  const currentYear          = new Date().getFullYear()
  const jorgeRetirementYear  = currentYear + (inputs.jorgeRetirementAge - context.jorgeAge)
  const graceRetirementYear  = currentYear + (inputs.graceRetirementAge - context.graceAge)
  const mortgagePaidOff      = mortgage.mortgageEndYear < jorgeRetirementYear
  const mortgageYearsBefore  = jorgeRetirementYear - mortgage.mortgageEndYear
  const mortgageAnnual       = mortgage.mortgagePaymentMonthly * 12
  const suggestedIncome      = mortgagePaidOff && mortgageAnnual > 0
    ? Math.max(0, Math.round((inputs.desiredRetirementIncome - mortgageAnnual) / 1000) * 1000)
    : null

  function numInput(field: Field, label: string, prefix = '$', step = 1000) {
    return (
      <div className="da-row">
        <span className="da-label">{label}</span>
        <div className="da-input">
          {prefix && <span className="input-prefix">{prefix}</span>}
          <input
            type="number"
            step={step}
            value={(inputs[field] as number)}
            onChange={e => set(field, parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>
    )
  }

  function pctSlider(field: Field, label: string, min: number, max: number, stepPct = 0.5) {
    const pct = (inputs[field] as number) * 100
    const dec = () => set(field, Math.max(min, parseFloat((pct - stepPct).toFixed(4))) / 100)
    const inc = () => set(field, Math.min(max, parseFloat((pct + stepPct).toFixed(4))) / 100)
    return (
      <div className="slider-group">
        <div className="slider-label">
          <span>{label}</span>
          <strong>{pct.toFixed(1)}%</strong>
        </div>
        <div className="slider-row">
          <button className="slider-btn" type="button" onClick={dec}>−</button>
          <input
            type="range"
            min={min}
            max={max}
            step={stepPct}
            value={pct}
            onChange={e => set(field, parseFloat(e.target.value) / 100)}
          />
          <button className="slider-btn" type="button" onClick={inc}>+</button>
        </div>
      </div>
    )
  }

  function ageInput(field: Field, label: string) {
    return (
      <div className="da-row">
        <span className="da-label">{label}</span>
        <div className="da-input">
          <input
            type="number"
            step={1}
            value={(inputs[field] as number)}
            onChange={e => set(field, parseInt(e.target.value) || 0)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <SuperBanner
        result={result}
        jorgeCurrentAge={context.jorgeAge}
        jorgeRetirementAge={inputs.jorgeRetirementAge}
      />

      <div className="two-col" style={{ marginTop: '1rem' }}>
        {/* ── Left: inputs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Jorge */}
          <Panel title="Jorge">
            <div className="da-grid">
              {numInput('jorgeBalance', 'Current balance', '$', 5000)}
              <div>
                {ageInput('jorgeRetirementAge', 'Planned retirement age')}
                <p className="small" style={{ marginTop: 3 }}>
                  {Math.max(0, inputs.jorgeRetirementAge - context.jorgeAge)}yr from now
                  {inputs.jorgeRetirementAge < 60 && ' · Before preservation age (60)'}
                  {inputs.jorgeRetirementAge !== 67 && inputs.jorgeRetirementAge >= 60 && ' · Standard pension age: 67'}
                </p>
              </div>
              {numInput('jorgeAdditionalContribs', 'Extra contributions / yr', '$', 500)}
            </div>
          </Panel>

          {/* Grace / Partner */}
          <Panel
            title="Grace"
            right={
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={inputs.partnerEnabled}
                  onChange={e => set('partnerEnabled', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            }
          >
            {inputs.partnerEnabled ? (
              <div className="da-grid">
                {numInput('graceBalance', 'Current balance', '$', 5000)}
                <div>
                  {ageInput('graceRetirementAge', 'Planned retirement age')}
                  <p className="small" style={{ marginTop: 3 }}>
                    {Math.max(0, inputs.graceRetirementAge - context.graceAge)}yr from now
                    {inputs.graceRetirementAge < 60 && ' · Before preservation age (60)'}
                    {inputs.graceRetirementAge !== 67 && inputs.graceRetirementAge >= 60 && ' · Standard pension age: 67'}
                  </p>
                </div>
                {numInput('graceAdditionalContribs', 'Extra contributions / yr', '$', 500)}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--t3)', margin: 0 }}>
                Toggle on to include Grace's super in the projection.
              </p>
            )}
          </Panel>

          {/* Assumptions */}
          <Panel title="Assumptions">
            {pctSlider('sgRate',           'SG rate',             10, 12,  0.5)}
            {pctSlider('investmentReturn', 'Investment return',    2, 12,  0.5)}
            {pctSlider('inflationRate',    'Inflation',            1,  7,  0.5)}
            {pctSlider('fundFeePercent',   'Fund fees (% p.a.)', 0.1,  2, 0.1)}
          </Panel>

          {/* Retirement income goal */}
          <Panel title="Retirement goal">
            <div className="da-grid">
              {numInput('desiredRetirementIncome', "Household income goal (today's $)", '$', 5000)}
            </div>
            {budgetAnnualSpend > 0 && inputs.desiredRetirementIncome !== budgetAnnualSpend && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Current annual spend: ${budgetAnnualSpend.toLocaleString('en-AU')}
                <button className="hint-link" onClick={() => set('desiredRetirementIncome', budgetAnnualSpend)}>
                  Reset to budget ↺
                </button>
              </div>
            )}
            {suggestedIncome !== null && mortgage.mortgagePaymentMonthly > 0 && (
              <div className="super-hint">
                <span>
                  Mortgage ends {mortgage.mortgageEndYear} ({mortgageYearsBefore} yr before retirement).
                  Without the ${Math.round(mortgage.mortgagePaymentMonthly / 1000)}k/mo mortgage payment,
                  consider a lower target:
                </span>
                <button
                  className="hint-link"
                  onClick={() => set('desiredRetirementIncome', suggestedIncome)}
                >
                  Apply ${suggestedIncome.toLocaleString('en-AU')}
                </button>
              </div>
            )}
          </Panel>

          {/* Salary & age from Budget — read-only context */}
          <div className="super-context-box">
            <div className="super-context-title">Salary & age from Budget</div>
            <div className="super-context-row">
              <span className="super-context-name">Jorge</span>
              <span className="super-context-detail">
                Age {context.jorgeAge}
                {' · '}${context.jorgeSalary.toLocaleString('en-AU')}/yr
                {' · '}Growth {(context.jorgeSalaryGrowth * 100).toFixed(1)}%
              </span>
            </div>
            {inputs.partnerEnabled && (
              <div className="super-context-row">
                <span className="super-context-name">Grace</span>
                <span className="super-context-detail">
                  Age {context.graceAge}
                  {' · '}${context.graceSalary.toLocaleString('en-AU')}/yr
                  {' · '}Growth {(context.graceSalaryGrowth * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <Link href="/budget" className="super-context-link">Edit in Budget →</Link>
          </div>

          <button
            className="add-btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>

        {/* ── Right: chart ── */}
        <Panel title="Balance over time" dotColor="var(--blue)">
          <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginBottom: '0.5rem' }}>
            {inputs.partnerEnabled
              ? 'Blue = Jorge · Purple = Grace · Green = Combined · Dashed = today\'s $'
              : 'Blue = accumulation · Amber = drawdown · Dashed = today\'s $'}
          </p>
          <SuperBalanceChart
            combined={result.combined}
            jorgeRows={result.jorge.rows}
            graceRows={result.grace?.rows ?? null}
            jorgeRetirementYear={jorgeRetirementYear}
            graceRetirementYear={inputs.partnerEnabled ? graceRetirementYear : null}
          />
          <div className="super-legend">
            {result.jorge.rows.some(r => r.capHit) && (
              <span className="super-badge cap">Cap</span>
            )}
            {result.jorge.rows.some(r => r.div293) && (
              <span className="super-badge div">Div293</span>
            )}
            {(result.jorge.rows.some(r => r.capHit) || result.jorge.rows.some(r => r.div293)) && (
              <span style={{ fontSize: '0.7rem', color: 'var(--t3)' }}>
                Cap = concessional cap exceeded · Div293 = Division 293 tax applies (income &gt; $250k)
              </span>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Projection table ── */}
      <div style={{ marginTop: '1rem' }}>
        <Panel title="Year-by-year projection" dotColor="var(--teal)">
          <SuperProjectionTable result={result} />
        </Panel>
      </div>
    </div>
  )
}
