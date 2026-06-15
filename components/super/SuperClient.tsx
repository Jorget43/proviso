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
import ConcessionalCarryForward, { type SuperHistoryItem } from './ConcessionalCarryForward'
import Panel from '@/components/ui/Panel'
import ReadOnlyFence from '@/components/ui/ReadOnlyFence'

interface MortgageContext {
  mortgagePaymentMonthly: number
  mortgageEndYear:        number
}

interface Props {
  canEdit:           boolean
  initial:           HouseholdSuperInputs
  context:           ProjectionContext
  mortgage:          MortgageContext
  budgetAnnualSpend: number
  person1Name:       string
  person2Name:       string
  superHistory:      SuperHistoryItem[]
  isRenting:         boolean
  rentMonthly:       number
}

type Field = keyof HouseholdSuperInputs

export default function SuperClient({ canEdit, initial, context, mortgage, budgetAnnualSpend, person1Name, person2Name, superHistory, isRenting, rentMonthly }: Props) {
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

  // Retirement year calculations
  const currentYear           = new Date().getFullYear()
  const person1RetirementYear = currentYear + (inputs.person1RetirementAge - context.person1Age)
  const person2RetirementYear = currentYear + (inputs.person2RetirementAge - context.person2Age)

  // Mortgage hints
  const mortgagePaidOff      = mortgage.mortgageEndYear < person1RetirementYear
  const mortgageStillLive    = mortgage.mortgagePaymentMonthly > 0 && !mortgagePaidOff
  const mortgageYearsBefore  = person1RetirementYear - mortgage.mortgageEndYear
  const mortgageYearsAfter   = mortgage.mortgageEndYear - person1RetirementYear
  const mortgageAnnual       = mortgage.mortgagePaymentMonthly * 12
  const suggestedIncome      = mortgagePaidOff && mortgageAnnual > 0
    ? Math.max(0, Math.round((inputs.desiredRetirementIncome - mortgageAnnual) / 1000) * 1000)
    : null

  // Inflation-adjusted nominal equivalent at person 1 retirement
  const yearsToRetirement1 = Math.max(0, inputs.person1RetirementAge - context.person1Age)
  const nominalAtRetirement = Math.round(
    inputs.desiredRetirementIncome * Math.pow(1 + inputs.inflationRate, yearsToRetirement1) / 1000
  ) * 1000

  function numInput(field: Field, label: string, prefix = '$', step = 1000) {
    return (
      <div className="da-row">
        <span className="da-label">{label}</span>
        {prefix
          ? <div className="input-prefix" style={{ flex: 1 }}>
              <span>{prefix}</span>
              <input
                type="number"
                step={step}
                value={(inputs[field] as number)}
                onChange={e => set(field, parseFloat(e.target.value) || 0)}
                style={{ textAlign: 'right' }}
              />
            </div>
          : <input
              className="da-input"
              type="number"
              step={step}
              value={(inputs[field] as number)}
              onChange={e => set(field, parseFloat(e.target.value) || 0)}
            />
        }
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
        person1CurrentAge={context.person1Age}
        person1RetirementAge={inputs.person1RetirementAge}
        person1Name={person1Name}
      />

      <div className="two-col" style={{ marginTop: '1rem' }}>
        {/* ── Left: inputs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Person 1 */}
          <Panel title={person1Name}>
            <div className="da-grid">
              {numInput('person1Balance', 'Current balance', '$', 5000)}
              <div>
                {ageInput('person1RetirementAge', 'Planned retirement age')}
                <p className="small" style={{ marginTop: 3 }}>
                  Age {inputs.person1RetirementAge} · {person1RetirementYear}
                  {' · '}{Math.max(0, inputs.person1RetirementAge - context.person1Age)}yr from now
                  {inputs.person1RetirementAge < 60 && ' · Before preservation age (60)'}
                  {inputs.person1RetirementAge !== 67 && inputs.person1RetirementAge >= 60 && ' · Standard pension age: 67'}
                </p>
              </div>
              {numInput('person1AdditionalContribs', 'Extra contributions / yr', '$', 500)}
            </div>
          </Panel>

          {/* Person 2 / Partner */}
          <Panel
            title={person2Name}
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
                {numInput('person2Balance', 'Current balance', '$', 5000)}
                <div>
                  {ageInput('person2RetirementAge', 'Planned retirement age')}
                  <p className="small" style={{ marginTop: 3 }}>
                    Age {inputs.person2RetirementAge} · {person2RetirementYear}
                    {' · '}{Math.max(0, inputs.person2RetirementAge - context.person2Age)}yr from now
                    {inputs.person2RetirementAge < 60 && ' · Before preservation age (60)'}
                    {inputs.person2RetirementAge !== 67 && inputs.person2RetirementAge >= 60 && ' · Standard pension age: 67'}
                  </p>
                </div>
                {numInput('person2AdditionalContribs', 'Extra contributions / yr', '$', 500)}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--t3)', margin: 0 }}>
                Toggle on to include {person2Name}&apos;s super in the projection.
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
            {/* Retirement timeline summary */}
            <div style={{ fontSize: '0.71rem', color: 'var(--t3)', marginBottom: 10, lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: 'var(--t2)' }}>{person1Name}</strong>
                {' — '}retires age {inputs.person1RetirementAge} in <strong style={{ color: 'var(--t2)' }}>{person1RetirementYear}</strong>
                {' '}({Math.max(0, inputs.person1RetirementAge - context.person1Age)} yrs from now)
              </div>
              {inputs.partnerEnabled && (
                <div>
                  <strong style={{ color: 'var(--t2)' }}>{person2Name}</strong>
                  {' — '}retires age {inputs.person2RetirementAge} in <strong style={{ color: 'var(--t2)' }}>{person2RetirementYear}</strong>
                  {' '}({Math.max(0, inputs.person2RetirementAge - context.person2Age)} yrs from now)
                </div>
              )}
            </div>

            <div className="da-grid">
              {numInput('desiredRetirementIncome', "Annual income goal (today's $)", '$', 5000)}
            </div>

            {/* Nominal equivalent at retirement */}
            {yearsToRetirement1 > 0 && (
              <p className="small" style={{ marginTop: 4 }}>
                ≈ <strong>${nominalAtRetirement.toLocaleString('en-AU')}</strong>/yr in {person1RetirementYear} dollars
                {' '}(at {(inputs.inflationRate * 100).toFixed(1)}% inflation)
              </p>
            )}

            {/* Budget spend hint */}
            {budgetAnnualSpend > 0 && inputs.desiredRetirementIncome !== budgetAnnualSpend && (
              <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Current annual spend: ${budgetAnnualSpend.toLocaleString('en-AU')}
                <button className="hint-link" onClick={() => set('desiredRetirementIncome', budgetAnnualSpend)}>
                  Use budget ↺
                </button>
              </div>
            )}

            {/* Mortgage cleared before retirement — suggest lower goal */}
            {suggestedIncome !== null && mortgage.mortgagePaymentMonthly > 0 && (
              <div className="super-hint">
                <span>
                  Mortgage clears {mortgage.mortgageEndYear} ({mortgageYearsBefore} yr before retirement).
                  Without the ${Math.round(mortgage.mortgagePaymentMonthly / 1000)}k/mo repayment,
                  consider a lower target:
                </span>
                <button className="hint-link" onClick={() => set('desiredRetirementIncome', suggestedIncome)}>
                  Apply ${suggestedIncome.toLocaleString('en-AU')}
                </button>
              </div>
            )}

            {/* Mortgage still running at retirement — flag higher goal */}
            {mortgageStillLive && (
              <div className="super-hint" style={{ background: 'var(--red-lt)', border: '1px solid rgba(180,30,30,0.2)', borderLeft: '3px solid var(--red)' }}>
                <span>
                  ⚠ Mortgage continues until {mortgage.mortgageEndYear}
                  {' '}({mortgageYearsAfter} yr past retirement). Income goal must cover the
                  ${Math.round(mortgage.mortgagePaymentMonthly / 1000)}k/mo repayment.
                </span>
              </div>
            )}

            {/* Renting at retirement — flag ongoing rent cost */}
            {isRenting && rentMonthly > 0 && (
              <div className="super-hint">
                <span>
                  ⚠ Renting at ${rentMonthly.toLocaleString('en-AU')}/mo. Include rent in your
                  income goal unless you plan to purchase before retirement.
                </span>
              </div>
            )}
          </Panel>

          {/* Salary & age from Budget — read-only context */}
          <div className="super-context-box">
            <div className="super-context-title">Salary & age from Budget</div>
            <div className="super-context-row">
              <span className="super-context-name">{person1Name}</span>
              <span className="super-context-detail">
                Age {context.person1Age}
                {' · '}${context.person1Salary.toLocaleString('en-AU')}/yr
                {' · '}Growth {(context.person1SalaryGrowth * 100).toFixed(1)}%
              </span>
            </div>
            {inputs.partnerEnabled && (
              <div className="super-context-row">
                <span className="super-context-name">{person2Name}</span>
                <span className="super-context-detail">
                  Age {context.person2Age}
                  {' · '}${context.person2Salary.toLocaleString('en-AU')}/yr
                  {' · '}Growth {(context.person2SalaryGrowth * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <Link href="/budget" className="super-context-link">Edit in Budget →</Link>
          </div>

          <ReadOnlyFence canEdit={canEdit} title="Read-only — only CFO members can save super settings">
            <button
              className="add-btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </ReadOnlyFence>
        </div>

        {/* ── Right: chart ── */}
        <Panel title="Balance over time" dotColor="var(--blue)">
          <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginBottom: '0.5rem' }}>
            {inputs.partnerEnabled
              ? `Blue = ${person1Name} · Purple = ${person2Name} · Green = Combined · Dashed = today's $`
              : 'Blue = accumulation · Amber = drawdown · Dashed = today\'s $'}
          </p>
          <SuperBalanceChart
            combined={result.combined}
            person1Rows={result.person1.rows}
            person2Rows={result.person2?.rows ?? null}
            person1RetirementYear={person1RetirementYear}
            person2RetirementYear={inputs.partnerEnabled ? person2RetirementYear : null}
            person1Name={person1Name}
            person2Name={person2Name}
          />
          <div className="super-legend">
            {result.person1.rows.some(r => r.capHit) && (
              <span className="super-badge cap">Cap</span>
            )}
            {result.person1.rows.some(r => r.div293) && (
              <span className="super-badge div">Div293</span>
            )}
            {(result.person1.rows.some(r => r.capHit) || result.person1.rows.some(r => r.div293)) && (
              <span style={{ fontSize: '0.7rem', color: 'var(--t3)' }}>
                Cap = concessional cap exceeded · Div293 = Division 293 tax applies (income &gt; $250k)
              </span>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Concessional cap carry-forward (Phase 2B) ── */}
      <div style={{ marginTop: '1rem' }}>
        <ReadOnlyFence canEdit={canEdit}>
          <ConcessionalCarryForward
            members={inputs.partnerEnabled ? [person1Name, person2Name] : [person1Name]}
            initialRows={superHistory}
          />
        </ReadOnlyFence>
      </div>

      {/* ── Projection table ── */}
      <div style={{ marginTop: '1rem' }}>
        <Panel title="Year-by-year projection" dotColor="var(--teal)">
          <SuperProjectionTable result={result} person1Name={person1Name} person2Name={person2Name} />
        </Panel>
      </div>
    </div>
  )
}
