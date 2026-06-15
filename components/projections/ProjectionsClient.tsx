'use client'
import { useState, useMemo, useCallback } from 'react'
import { toMonthly, fmtK } from '@/lib/formatting'
import { runProjections, type ProjectionInputs } from '@/lib/projections'
import { type FeeSchedule } from '@/lib/schoolFees'
import { LOCATION_OPTIONS, presetScheduleFor, presetTotalFor } from '@/lib/educationCosts'

interface FeeRow { id: number; level: string; tuition: number; fixed: number }
import Panel from '@/components/ui/Panel'
import ReadOnlyFence from '@/components/ui/ReadOnlyFence'
import NetWorthChart      from './NetWorthChart'
import PartnerIncomeChart from './GraceIncomeChart'
import IncExpProjChart    from './IncExpProjChart'
import DeficitChart       from './DeficitChart'
import MortStressChart    from './MortStressChart'
import MortPaydownChart   from './MortPaydownChart'
import SchoolFeeChart     from './SchoolFeeChart'
import WorkPhaseTimeline, { type WorkPhaseRow } from './GraceTimeline'
import OneOffPanel,       { type OneOffRow }      from './OneOffPanel'
import LifePhasesPanel                            from './LifePhasesPanel'
import type { LifePhase } from '@/lib/lifephases'

interface ProjSettings {
  id:            number
  person1Growth: number
  person2Growth: number
  expInflNear:   number
  expInfl:       number
  childcareInfl: number
  propGrowth:    number
  savingsRate:   number
  investReturn:  number
  projYears:     number
  parentalLeaveEnabled: boolean
  schoolFeesOn:  boolean
  sfC1Start:     number
  sfC1ExitIdx:   number
  sfC2Start:     number
  sfC2ExitIdx:   number
  sfInfl:        number
  sfPresetKey:   string | null
}

interface IncSettings {
  person1FTE:        number
  person2FTE:        number
  person2HasHELP:    boolean
  taxMode:           boolean
  person1MonthlyNet: number
  person2MonthlyNet: number
}

interface RentSettingsType {
  id:                    number
  enabled:               boolean
  monthlyRent:           number
  annualIncreaseRate:    number
  purchasePlanEnabled:   boolean
  targetPurchaseYear:    number
  targetPropertyValue:   number
  depositPct:            number
  depositFromCash:       number
  depositFromInvestments: number
  newMortgageRate:       number
  newMortgageTermYrs:    number
}

interface ProjectionsClientProps {
  canEdit:              boolean
  initialSettings:      ProjSettings
  initialPerson1Phases: WorkPhaseRow[]
  initialPerson2Phases: WorkPhaseRow[]
  initialOneoffs:       OneOffRow[]
  initialLifePhases:    LifePhase[]
  initialFeeSchedule:   FeeRow[]
  income:               IncSettings
  baseMonthlyExpenses:  number
  mortBalance:          number
  mortRate:             number
  mortPayment:          number
  mortEndDate:          string
  cashOnHand:           number
  propValue:            number
  cryptoValue:          number
  currentYear:          number
  person1Name:          string
  person2Name:          string
  initialRentSettings:  RentSettingsType | null
}

const DEFAULT_RENT: RentSettingsType = {
  id: 1, enabled: false, monthlyRent: 0, annualIncreaseRate: 5.0,
  purchasePlanEnabled: false, targetPurchaseYear: new Date().getFullYear() + 5,
  targetPropertyValue: 800000, depositPct: 20.0,
  depositFromCash: 0, depositFromInvestments: 0,
  newMortgageRate: 6.0, newMortgageTermYrs: 30,
}

export default function ProjectionsClient({
  canEdit,
  initialSettings, initialPerson1Phases, initialPerson2Phases, initialOneoffs, initialLifePhases, initialFeeSchedule,
  income, baseMonthlyExpenses,
  mortBalance, mortRate, mortPayment, mortEndDate,
  cashOnHand, propValue, cryptoValue, currentYear,
  person1Name, person2Name, initialRentSettings,
}: ProjectionsClientProps) {
  const [settings,       setSettings]       = useState<ProjSettings>(initialSettings)
  const [person1Phases,  setPerson1Phases]  = useState<WorkPhaseRow[]>(initialPerson1Phases)
  const [person2Phases,  setPerson2Phases]  = useState<WorkPhaseRow[]>(initialPerson2Phases)
  const [feeRows,     setFeeRows]     = useState<FeeRow[]>(initialFeeSchedule)
  const [oneoffs,     setOneoffs]     = useState<OneOffRow[]>(initialOneoffs)
  const [lifePhases,  setLifePhases]  = useState<LifePhase[]>(initialLifePhases)
  const [rentSt,      setRentSt]      = useState<RentSettingsType>(initialRentSettings ?? DEFAULT_RENT)

  const sfSchedule = useMemo<FeeSchedule>(() => {
    if (settings.sfPresetKey) {
      return presetScheduleFor(settings.sfPresetKey) ?? Object.fromEntries(feeRows.map(r => [r.level, { tuition: r.tuition, fixed: r.fixed }]))
    }
    return Object.fromEntries(feeRows.map(r => [r.level, { tuition: r.tuition, fixed: r.fixed }]))
  }, [feeRows, settings.sfPresetKey])

  const saveFeeRow = useCallback(async (id: number, field: 'tuition' | 'fixed', value: number) => {
    setFeeRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    await fetch(`/api/school-fee-levels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tuition: feeRows.find(r => r.id === id)?.tuition ?? 0, fixed: feeRows.find(r => r.id === id)?.fixed ?? 0, [field]: value }),
    })
  }, [feeRows])

  const inputs = useMemo<ProjectionInputs>(() => ({
    person1FTE:           income.person1FTE,
    person2FTE:           income.person2FTE,
    taxMode:              income.taxMode,
    person2HasHELP:       income.person2HasHELP,
    person2HELPBalance:   income.person2HasHELP ? 50000 : 0,
    person1MonthlyNet:    income.person1MonthlyNet,
    person2MonthlyNet:    income.person2MonthlyNet,
    person1GrowthRate:    settings.person1Growth,
    person2GrowthRate:    settings.person2Growth,
    expInflNear:          settings.expInflNear,
    expInfl:              settings.expInfl,
    childcareInfl:        settings.childcareInfl,
    propGrowth:           settings.propGrowth,
    savingsRate:          settings.savingsRate,
    investReturn:         settings.investReturn,
    projYears:            settings.projYears,
    mortBalance,
    mortRate,
    mortPayment,
    cashOnHand,
    propValue,
    cryptoValue,
    helpDebt:             income.person2HasHELP ? 50000 : 0,
    person1Phases,
    person2Phases,
    baseMonthlyExpenses,
    oneoffs,
    parentalLeaveEnabled: settings.parentalLeaveEnabled,
    schoolFeesOn:         settings.schoolFeesOn,
    sfC1Start:            settings.sfC1Start,
    sfC1ExitIdx:          settings.sfC1ExitIdx,
    sfC2Start:            settings.sfC2Start,
    sfC2ExitIdx:          settings.sfC2ExitIdx,
    sfInfl:               settings.sfInfl,
    sfSchedule:           sfSchedule,
    lifePhases,
    currentYear,
    rentMode:              rentSt.enabled,
    monthlyRent:           rentSt.monthlyRent,
    rentIncreaseRate:      rentSt.annualIncreaseRate,
    purchasePlanEnabled:   rentSt.purchasePlanEnabled,
    targetPurchaseYear:    rentSt.targetPurchaseYear,
    targetPropertyValue:   rentSt.targetPropertyValue,
    depositPct:            rentSt.depositPct,
    depositFromCash:       rentSt.depositFromCash,
    depositFromInvestments: rentSt.depositFromInvestments,
    newMortgageRate:       rentSt.newMortgageRate,
    newMortgageTermYrs:    rentSt.newMortgageTermYrs,
  }), [settings, person1Phases, person2Phases, oneoffs, lifePhases, income, sfSchedule, baseMonthlyExpenses, mortBalance, mortRate, mortPayment, cashOnHand, propValue, cryptoValue, currentYear, rentSt])

  const output = useMemo(() => runProjections(inputs), [inputs])
  const main   = output.withFees ?? output.base
  const sfOn   = settings.schoolFeesOn

  // ── Banner values ──
  const initNW  = (rentSt.enabled ? 0 : propValue) + cashOnHand + cryptoValue - (rentSt.enabled ? 0 : mortBalance)
  const finalNW = main.nwArr[main.nwArr.length - 1]
  const clearedIdx = main.mortArr.findIndex(v => v <= 0)
  const mortCleared = clearedIdx >= 0 ? output.labels[clearedIdx] : 'Not in period'
  const finalInvest = main.investArr[main.investArr.length - 1]
  const totalFees   = sfOn ? main.sfTotalArr.reduce((s, v) => s + v, 0) : 0
  const nwNoFeesFinal = output.base.nwArr[output.base.nwArr.length - 1]
  const nwFeeCost   = sfOn ? nwNoFeesFinal - finalNW : 0
  const totalRentPaid = main.rentArr.reduce((s, v) => s + v, 0)

  // ── Settings patch helpers ──
  const patchSettings = useCallback(async (patch: Partial<ProjSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
    await fetch('/api/projection-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }, [])

  const patchRent = useCallback(async (patch: Partial<RentSettingsType>) => {
    setRentSt(prev => {
      const next = { ...prev, ...patch }
      fetch('/api/rent-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      return next
    })
  }, [])

  // ── Person1 phase CRUD ──
  const addPerson1Phase = useCallback(async () => {
    const maxY = person1Phases.length ? Math.max(...person1Phases.map(p => p.year)) : currentYear
    const res = await fetch('/api/person1-phases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: maxY + 2, days: 5 }),
    })
    const created: WorkPhaseRow = await res.json()
    setPerson1Phases(prev => [...prev, created])
  }, [person1Phases, currentYear])

  const updatePerson1Phase = useCallback(async (id: number, field: string, value: number) => {
    setPerson1Phases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
    await fetch(`/api/person1-phases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }, [])

  const deletePerson1Phase = useCallback(async (id: number) => {
    setPerson1Phases(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/person1-phases/${id}`, { method: 'DELETE' })
  }, [])

  // ── Person2 phase CRUD ──
  const addPerson2Phase = useCallback(async () => {
    const maxY = person2Phases.length ? Math.max(...person2Phases.map(p => p.year)) : currentYear
    const res = await fetch('/api/person2-phases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: maxY + 2, days: 3 }),
    })
    const created: WorkPhaseRow = await res.json()
    setPerson2Phases(prev => [...prev, created])
  }, [person2Phases, currentYear])

  const updatePerson2Phase = useCallback(async (id: number, field: string, value: number) => {
    setPerson2Phases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
    await fetch(`/api/person2-phases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }, [])

  const deletePerson2Phase = useCallback(async (id: number) => {
    setPerson2Phases(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/person2-phases/${id}`, { method: 'DELETE' })
  }, [])

  // ── One-off CRUD ──
  const addOneoff = useCallback(async () => {
    const res = await fetch('/api/one-offs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New expense', amt: 0, year: currentYear + 1 }),
    })
    const created: OneOffRow = await res.json()
    setOneoffs(prev => [...prev, created])
  }, [currentYear])

  const updateOneoff = useCallback(async (id: number, field: string, value: string | number) => {
    const parsed = field === 'name' ? value : (field === 'year' ? parseInt(String(value)) : parseFloat(String(value)) || 0)
    setOneoffs(prev => prev.map(o => o.id === id ? { ...o, [field]: parsed } : o))
    await fetch(`/api/one-offs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
  }, [])

  const deleteOneoff = useCallback(async (id: number) => {
    setOneoffs(prev => prev.filter(o => o.id !== id))
    await fetch(`/api/one-offs/${id}`, { method: 'DELETE' })
  }, [])

  // ── Life phase toggle ──
  const toggleLifePhase = useCallback(async (id: number, enabled: boolean) => {
    setLifePhases(prev => prev.map(p => p.id === id ? { ...p, enabled } : p))
    await fetch(`/api/life-phases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  }, [])

  function Slider({ label, id, min, max, step, value, cls, fmt: fmtFn = (v: number) => v + '%', onChange }: {
    label: string; id: string; min: number; max: number; step: number; value: number; cls: string; fmt?: (v: number) => string; onChange?: (v: number) => void
  }) {
    const apply = (v: number) => {
      if (onChange) onChange(v)
      else patchSettings({ [id]: v } as Partial<ProjSettings>)
    }
    const dec = (v: number) => apply(Math.max(min, parseFloat((v - step).toFixed(4))))
    const inc = (v: number) => apply(Math.min(max, parseFloat((v + step).toFixed(4))))
    return (
      <div className="slider-group">
        <div className="slider-label">
          {label} <span>{fmtFn(value)}</span>
        </div>
        <div className="slider-row">
          <button className="slider-btn" type="button" onClick={() => dec(value)}>−</button>
          <input
            type="range" className={cls} min={min} max={max} step={step}
            value={value}
            onChange={e => apply(parseFloat(e.target.value))}
          />
          <button className="slider-btn" type="button" onClick={() => inc(value)}>+</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <ReadOnlyFence canEdit={canEdit}>
      {/* ── Banner ── */}
      <div className="banner">
        <div className="b-item"><div className="b-label">Net worth in {settings.projYears} yrs</div><div className="b-value green">{fmtK(finalNW)}</div></div>
        <div className="b-div" />
        <div className="b-item"><div className="b-label">Growth</div><div className="b-value green">+{fmtK(finalNW - initNW)}</div></div>
        <div className="b-div" />
        {rentSt.enabled
          ? <div className="b-item"><div className="b-label">Total rent paid</div><div className="b-value red">{fmtK(totalRentPaid)}</div></div>
          : <div className="b-item"><div className="b-label">Mortgage cleared</div><div className="b-value">{mortCleared}</div></div>
        }
        <div className="b-div" />
        <div className="b-item"><div className="b-label">Investments</div><div className="b-value blue">{fmtK(finalInvest)}</div></div>
        {sfOn && (<>
          <div className="b-div" />
          <div className="b-item"><div className="b-label">Total school fees</div><div className="b-value red">{fmtK(totalFees)}</div></div>
          <div className="b-div" />
          <div className="b-item"><div className="b-label">NW cost of schooling</div><div className="b-value red">{fmtK(nwFeeCost)}</div></div>
        </>)}
      </div>

      {/* ── Sidebar layout ── */}
      <div className="sidebar-layout">
        {/* ── Main column ── */}
        <div>
          <Panel title="Net worth trajectory" dotColor="var(--green)">
            <NetWorthChart
              labels={output.labels} nwData={main.nwArr} nwNoFees={sfOn ? output.base.nwArr : null}
              investData={main.investArr} cashData={main.cashArr} sfOn={sfOn}
            />
          </Panel>
          <div style={{ marginTop: '1rem' }}>
            <Panel title="Income by person" dotColor="var(--pink)">
              <PartnerIncomeChart
                labels={output.labels}
                person1Data={main.person1Arr} person2Data={main.person2Arr}
                person1Name={person1Name}   person2Name={person2Name}
                leaveYrs={main.leaveYrs}
                person1FTE={income.person1FTE} person2FTE={income.person2FTE}
                person1Growth={settings.person1Growth} person2Growth={settings.person2Growth}
              />
              <p className="proj-note mt1">Pink = {person2Name} on leave. Dashed = FTE reference per person.</p>
            </Panel>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Panel title="Annual income vs expenses" dotColor="var(--blue)">
              <IncExpProjChart
                labels={output.labels} incData={main.incArr} expData={main.expArr}
                phaseData={main.phaseArr} sfTotalData={main.sfTotalArr} sfOn={sfOn}
              />
            </Panel>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Panel
              title="Income vs expenses — deficit years highlighted"
              dotColor="var(--red)"
              right={main.deficitArr.filter(v => v < 0).length > 0
                ? <span className="pill pill-red">{main.deficitArr.filter(v => v < 0).length} deficit year{main.deficitArr.filter(v => v < 0).length > 1 ? 's' : ''}</span>
                : undefined}
            >
              <DeficitChart labels={output.labels} deficitData={main.deficitArr} cashRunningData={main.cashRunningArr} />
            </Panel>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Panel
              title="Mortgage stress & housing cost ratio"
              dotColor="var(--amber)"
              right={main.mortStressArr.filter(v => v > 30).length > 0
                ? <span className={`pill ${Math.max(...main.mortStressArr) > 35 ? 'pill-red' : 'pill-amber'}`}>{main.mortStressArr.filter(v => v > 30).length} stress year{main.mortStressArr.filter(v => v > 30).length > 1 ? 's' : ''}</span>
                : undefined}
            >
              <MortStressChart labels={output.labels} stressData={main.mortStressArr} />
            </Panel>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Panel title="Mortgage paydown" dotColor="var(--purple)">
              <MortPaydownChart labels={output.labels} mortData={main.mortArr} endDate={mortEndDate} />
            </Panel>
          </div>
          {sfOn && (
            <div style={{ marginTop: '1rem' }}>
              <Panel title="Annual school fees breakdown" dotColor="var(--teal)" right={<span className="pill pill-teal">{fmtK(totalFees)} total</span>}>
                <SchoolFeeChart
                  labels={output.labels} sfC1Arr={main.sfC1Arr} sfC2Arr={main.sfC2Arr}
                  sfSibArr={main.sfSibArr} sfTotalArr={main.sfTotalArr}
                  sfC1Start={settings.sfC1Start} sfC1ExitIdx={settings.sfC1ExitIdx}
                  sfC2Start={settings.sfC2Start} sfC2ExitIdx={settings.sfC2ExitIdx}
                />
              </Panel>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div>
          <Panel title={`${person1Name}'s working pattern`} dotColor="var(--blue)">
            <WorkPhaseTimeline
              phases={person1Phases} currentYear={currentYear}
              fte={income.person1FTE} showLeave={false}
              onUpdate={updatePerson1Phase} onDelete={deletePerson1Phase} onAdd={addPerson1Phase}
            />
          </Panel>

          <div style={{ marginTop: '1rem' }}>
            <Panel
              title={`${person2Name}'s working pattern`}
              dotColor="var(--pink)"
              right={
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--t3)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.parentalLeaveEnabled}
                    onChange={e => patchSettings({ parentalLeaveEnabled: e.target.checked })}
                  />
                  Parental leave
                </label>
              }
            >
              <WorkPhaseTimeline
                phases={person2Phases} currentYear={currentYear}
                fte={income.person2FTE}
                showLeave={settings.parentalLeaveEnabled}
                onUpdate={updatePerson2Phase} onDelete={deletePerson2Phase} onAdd={addPerson2Phase}
              />
            </Panel>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Panel title="Income & wage growth" dotColor="var(--blue)">
              <Slider label={`${person2Name} wage growth / yr`} id="person2Growth" min={0} max={15} step={0.5} value={settings.person2Growth} cls="green-t" />
              <Slider label={`${person1Name} wage growth / yr`} id="person1Growth" min={0} max={15} step={0.5} value={settings.person1Growth} cls="blue-t"  />
            </Panel>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Panel title="Economy & investments" dotColor="var(--amber)">
              <Slider label="Near-term inflation 2026–28" id="expInflNear"   min={0} max={10}  step={0.5} value={settings.expInflNear}   cls="red-t"    />
              <Slider label="Long-run inflation 2029+"    id="expInfl"       min={0} max={8}   step={0.5} value={settings.expInfl}       cls="red-t"    />
              <Slider label="Childcare inflation / yr"    id="childcareInfl" min={0} max={15}  step={0.5} value={settings.childcareInfl} cls="pink-t"   />
              <Slider label="Property growth / yr"        id="propGrowth"    min={0} max={12}  step={0.5} value={settings.propGrowth}    cls="amber-t"  />
              <Slider label="Surplus invested %"          id="savingsRate"   min={0} max={100} step={5}   value={settings.savingsRate}   cls="purple-t" fmt={v => v + '%'} />
              <Slider label="Investment return / yr"      id="investReturn"  min={0} max={15}  step={0.5} value={settings.investReturn}  cls="purple-t" />
              <Slider label="Projection horizon"          id="projYears"     min={5} max={40}  step={1}   value={settings.projYears}     cls="amber-t"  fmt={v => v + ' yrs'} />
            </Panel>
          </div>

          {/* ── Housing mode ─────────────────────────────────────────── */}
          <div style={{ marginTop: '1rem' }}>
            <Panel title="Housing" dotColor="var(--purple)">
              {/* Homeowner / Renter toggle */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                {(['Homeowner', 'Renter'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => patchRent({ enabled: mode === 'Renter' })}
                    style={{
                      flex: 1, padding: '5px 0', fontSize: '0.72rem', borderRadius: 5, cursor: 'pointer',
                      background: rentSt.enabled === (mode === 'Renter') ? 'var(--blue)' : 'var(--surface2)',
                      color: rentSt.enabled === (mode === 'Renter') ? '#fff' : 'var(--t2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {rentSt.enabled && (
                <div className="da-grid" style={{ gap: 8 }}>
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Monthly rent</label>
                    <div className="input-prefix" style={{ width: 110 }}>
                      <span>$</span>
                      <input
                        type="number" min="0" step="50"
                        value={rentSt.monthlyRent}
                        onChange={e => patchRent({ monthlyRent: parseFloat(e.target.value) || 0 })}
                        style={{ textAlign: 'right' }}
                      />
                    </div>
                  </div>
                  <Slider
                    label="Annual rent increase" id="rentIncreaseRate" min={0} max={15} step={0.5}
                    value={rentSt.annualIncreaseRate} cls="red-t"
                    onChange={v => patchRent({ annualIncreaseRate: v })}
                  />
                  <p style={{ fontSize: '0.67rem', color: 'var(--t3)', margin: '2px 0 4px', lineHeight: 1.4 }}>
                    Rent is modelled separately — remove any rent expense from your budget to avoid double-counting.
                  </p>

                  {/* Purchase plan */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.73rem', color: 'var(--t2)', cursor: 'pointer', marginBottom: rentSt.purchasePlanEnabled ? 10 : 0 }}>
                      <input
                        type="checkbox"
                        checked={rentSt.purchasePlanEnabled}
                        onChange={e => patchRent({ purchasePlanEnabled: e.target.checked })}
                      />
                      Model home purchase
                    </label>

                    {rentSt.purchasePlanEnabled && (
                      <div className="da-grid" style={{ gap: 8 }}>
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Purchase year</label>
                          <input
                            className="da-input narrow" type="number"
                            value={rentSt.targetPurchaseYear}
                            min={currentYear + 1} max={currentYear + 30}
                            onChange={e => patchRent({ targetPurchaseYear: parseInt(e.target.value) })}
                          />
                        </div>
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Property value</label>
                          <div className="input-prefix" style={{ width: 110 }}>
                            <span>$</span>
                            <input
                              type="number" min="0" step="10000"
                              value={rentSt.targetPropertyValue}
                              onChange={e => patchRent({ targetPropertyValue: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: 'right' }}
                            />
                          </div>
                        </div>
                        <Slider
                          label="Deposit %" id="depositPct" min={5} max={40} step={5}
                          value={rentSt.depositPct} cls="amber-t" fmt={v => v + '%'}
                          onChange={v => patchRent({ depositPct: v })}
                        />
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Deposit from savings</label>
                          <div className="input-prefix" style={{ width: 110 }}>
                            <span>$</span>
                            <input
                              type="number" min="0" step="1000"
                              value={rentSt.depositFromCash}
                              onChange={e => patchRent({ depositFromCash: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: 'right' }}
                            />
                          </div>
                        </div>
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Deposit from investments</label>
                          <div className="input-prefix" style={{ width: 110 }}>
                            <span>$</span>
                            <input
                              type="number" min="0" step="1000"
                              value={rentSt.depositFromInvestments}
                              onChange={e => patchRent({ depositFromInvestments: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: 'right' }}
                            />
                          </div>
                        </div>
                        <Slider
                          label="New mortgage rate" id="newMortgageRate" min={3} max={12} step={0.25}
                          value={rentSt.newMortgageRate} cls="blue-t"
                          onChange={v => patchRent({ newMortgageRate: v })}
                        />
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Mortgage term</label>
                          <select
                            className="freq-select"
                            value={rentSt.newMortgageTermYrs}
                            onChange={e => patchRent({ newMortgageTermYrs: parseInt(e.target.value) })}
                            style={{ width: 90 }}
                          >
                            {[20, 25, 30, 35].map(y => <option key={y} value={y}>{y} yrs</option>)}
                          </select>
                        </div>
                        <p style={{ fontSize: '0.67rem', color: 'var(--t3)', margin: '2px 0', lineHeight: 1.4 }}>
                          Investment sale applies a ~12% effective CGT haircut. Check the Investments tab for exact CGT.
                        </p>
                        <div style={{
                          background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px',
                          fontSize: '0.72rem', color: 'var(--t2)', lineHeight: 1.5,
                        }}>
                          <strong>Purchase {rentSt.targetPurchaseYear}</strong><br/>
                          Property: ${rentSt.targetPropertyValue.toLocaleString('en-AU')}<br/>
                          Deposit ({rentSt.depositPct}%): ${Math.round(rentSt.targetPropertyValue * rentSt.depositPct / 100).toLocaleString('en-AU')}<br/>
                          Mortgage: ${Math.round(rentSt.targetPropertyValue * (1 - rentSt.depositPct / 100)).toLocaleString('en-AU')} @ {rentSt.newMortgageRate}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Panel title="One-off expenses" dotColor="var(--blue)">
              <OneOffPanel oneoffs={oneoffs} onAdd={addOneoff} onUpdate={updateOneoff} onDelete={deleteOneoff} />
            </Panel>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Panel
              title="School fees"
              dotColor="var(--teal)"
              right={
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.schoolFeesOn} onChange={e => patchSettings({ schoolFeesOn: e.target.checked })} />
                  <span className="toggle-slider" />
                </label>
              }
            >
              {settings.schoolFeesOn && (
                <div className="da-grid" style={{ gap: 8 }}>
                  {/* ── Education preset selector ──────────────────────── */}
                  {(() => {
                    const parts = settings.sfPresetKey?.split('|')
                    const sfLoc  = parts?.[0] ?? 'vic'
                    const sfType = parts?.[1] ?? 'independent'
                    const isCustom = !settings.sfPresetKey
                    const preset13 = settings.sfPresetKey ? presetTotalFor(settings.sfPresetKey) : null
                    return (
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--t3)', marginBottom: 5 }}>School type</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                          {(['government','catholic','independent'] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => patchSettings({ sfPresetKey: `${sfLoc}|${t}` })}
                              style={{
                                padding: '4px 10px', fontSize: '0.72rem', borderRadius: 5, cursor: 'pointer',
                                background: !isCustom && sfType === t ? 'var(--blue)' : 'var(--surface2)',
                                color: !isCustom && sfType === t ? '#fff' : 'var(--t2)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                          <button
                            onClick={() => patchSettings({ sfPresetKey: null })}
                            style={{
                              padding: '4px 10px', fontSize: '0.72rem', borderRadius: 5, cursor: 'pointer',
                              background: isCustom ? 'var(--blue)' : 'var(--surface2)',
                              color: isCustom ? '#fff' : 'var(--t2)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            Custom
                          </button>
                        </div>
                        {!isCustom && (
                          <div className="da-row" style={{ marginBottom: 6 }}>
                            <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Location</label>
                            <select
                              className="freq-select"
                              value={sfLoc}
                              onChange={e => patchSettings({ sfPresetKey: `${e.target.value}|${sfType}` })}
                              style={{ flex: '0 0 auto', width: 165 }}
                            >
                              {LOCATION_OPTIONS.map(l => (
                                <option key={l.key} value={l.key}>{l.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {preset13 && (
                          <div style={{ fontSize: '0.71rem', color: 'var(--t3)', marginBottom: 4, lineHeight: 1.4 }}>
                            13-yr cost estimate: ~<strong style={{ color: 'var(--t2)' }}>${preset13.toLocaleString('en-AU')}</strong> per child (2025 $, before fee inflation)
                            {' · '}
                            <span style={{ fontSize: '0.67rem' }}>Source: Futurity Invest 2026</span>
                          </div>
                        )}
                        <div style={{ borderBottom: '1px solid var(--border)', margin: '6px 0' }} />
                      </div>
                    )
                  })()}
                  {/* ── Child settings ────────────────────────────────── */}
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Child 1 starts Kinder</label>
                    <input className="da-input narrow" type="number" value={settings.sfC1Start} min={2024} max={2040} onChange={e => patchSettings({ sfC1Start: parseInt(e.target.value) })} />
                  </div>
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Child 1 exits after</label>
                    <select className="freq-select" value={settings.sfC1ExitIdx} onChange={e => patchSettings({ sfC1ExitIdx: parseInt(e.target.value) })} style={{ flex: '0 0 auto', width: 110 }}>
                      {feeRows.map((r, i) => <option key={r.id} value={i}>{r.level}</option>)}
                    </select>
                  </div>
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Child 2 starts Kinder</label>
                    <input className="da-input narrow" type="number" value={settings.sfC2Start} min={2024} max={2040} onChange={e => patchSettings({ sfC2Start: parseInt(e.target.value) })} />
                  </div>
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Child 2 exits after</label>
                    <select className="freq-select" value={settings.sfC2ExitIdx} onChange={e => patchSettings({ sfC2ExitIdx: parseInt(e.target.value) })} style={{ flex: '0 0 auto', width: 110 }}>
                      {feeRows.map((r, i) => <option key={r.id} value={i}>{r.level}</option>)}
                    </select>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <Slider label="Fee inflation / yr" id="sfInfl" min={0} max={10} step={0.5} value={settings.sfInfl} cls="teal-t" />
                  </div>
                  {/* Editable fee schedule — only in Custom mode */}
                  <details style={{ marginTop: 8, display: settings.sfPresetKey ? 'none' : undefined }}>
                    <summary style={{ fontSize: '0.73rem', color: 'var(--t2)', cursor: 'pointer', userSelect: 'none' }}>
                      Edit current fee schedule ({new Date().getFullYear()} $)
                    </summary>
                    <div style={{ marginTop: 8, overflowX: 'auto' }}>
                      <table className="tl-table">
                        <thead>
                          <tr>
                            <th>Year level</th>
                            <th style={{ textAlign: 'right' }}>Tuition</th>
                            <th style={{ textAlign: 'right' }}>Fixed / levies</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feeRows.map(r => (
                            <tr key={r.id}>
                              <td style={{ fontSize: '0.73rem', color: 'var(--t2)' }}>{r.level}</td>
                              <td>
                                <div className="input-prefix" style={{ width: 100 }}>
                                  <span>$</span>
                                  <input
                                    type="number" min="0" step="100"
                                    defaultValue={r.tuition}
                                    style={{ textAlign: 'right', fontSize: '0.72rem' }}
                                    onBlur={e => saveFeeRow(r.id, 'tuition', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="input-prefix" style={{ width: 100 }}>
                                  <span>$</span>
                                  <input
                                    type="number" min="0" step="100"
                                    defaultValue={r.fixed}
                                    style={{ textAlign: 'right', fontSize: '0.72rem' }}
                                    onBlur={e => saveFeeRow(r.id, 'fixed', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p style={{ fontSize: '0.67rem', color: 'var(--t3)', marginTop: 6, lineHeight: 1.4 }}>
                        Enter today&apos;s fees. Projections inflate these at the &ldquo;Fee inflation&rdquo; rate above.
                        A 15% sibling discount applies to Child 2&apos;s tuition when both are enrolled.
                      </p>
                    </div>
                  </details>
                </div>
              )}
            </Panel>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Panel
              title="Life phase expenses"
              dotColor="var(--teal)"
              right={
                lifePhases.filter(p => p.enabled).length > 0
                  ? <span className="pill pill-teal">{lifePhases.filter(p => p.enabled).length} active</span>
                  : undefined
              }
            >
              <LifePhasesPanel phases={lifePhases} onToggle={toggleLifePhase} />
            </Panel>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Panel title="Projection summary" dotColor="var(--purple)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.74rem' }}>
                {[
                  { label: 'Starting net worth',  val: fmtK(initNW),          color: '' },
                  { label: 'Final net worth',      val: fmtK(finalNW),         color: 'var(--green)' },
                  ...(sfOn ? [
                    { label: 'Final NW (no school fees)',   val: fmtK(nwNoFeesFinal), color: '' },
                    { label: 'NW cost of schooling',        val: fmtK(nwFeeCost),     color: 'var(--red)' },
                    { label: 'Total fees paid',             val: fmtK(totalFees),     color: 'var(--red)' },
                  ] : []),
                  { label: 'Final cash',      val: fmtK(main.cashArr[main.cashArr.length - 1]),     color: '' },
                  { label: 'Final investments', val: fmtK(finalInvest), color: 'var(--purple)' },
                  { label: 'Final mortgage',  val: fmtK(main.mortArr[main.mortArr.length - 1]),     color: 'var(--red)' },
                  { label: 'Expense base',    val: '$' + Math.round(baseMonthlyExpenses).toLocaleString('en-AU') + '/mo', color: '' },
                  { label: 'Leave years',     val: main.leaveYrs.join(', ') || 'None',             color: main.leaveYrs.length ? 'var(--pink)' : '' },
                  ...(income.person2HasHELP ? [{ label: 'Person2 HELP cleared', val: main.helpClearedYr ? String(main.helpClearedYr) : `Beyond ${settings.projYears}yr horizon`, color: main.helpClearedYr ? 'var(--teal)' : '' }] : []),
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--t2)' }}>{label}</span>
                    <span style={{ fontWeight: 500, color: color || undefined }}>{val}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
      </ReadOnlyFence>
    </div>
  )
}
