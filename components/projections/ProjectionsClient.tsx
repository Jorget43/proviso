'use client'
import { useState, useMemo, useCallback } from 'react'
import { toMonthly, fmtK } from '@/lib/formatting'
import { runProjections, type ProjectionInputs } from '@/lib/projections'
import { type FeeSchedule } from '@/lib/schoolFees'

interface FeeRow { id: number; level: string; tuition: number; fixed: number }
import Panel from '@/components/ui/Panel'
import NetWorthChart      from './NetWorthChart'
import GraceIncomeChart   from './GraceIncomeChart'
import IncExpProjChart    from './IncExpProjChart'
import DeficitChart       from './DeficitChart'
import MortStressChart    from './MortStressChart'
import MortPaydownChart   from './MortPaydownChart'
import SchoolFeeChart     from './SchoolFeeChart'
import GraceTimeline,     { type GracePhaseRow } from './GraceTimeline'
import OneOffPanel,       { type OneOffRow }      from './OneOffPanel'
import LifePhasesPanel                            from './LifePhasesPanel'
import type { LifePhase } from '@/lib/lifephases'

interface ProjSettings {
  id:            number
  jorgeGrowth:   number
  graceGrowth:   number
  expInflNear:   number
  expInfl:       number
  childcareInfl: number
  propGrowth:    number
  savingsRate:   number
  investReturn:  number
  projYears:     number
  schoolFeesOn:  boolean
  sfC1Start:     number
  sfC1ExitIdx:   number
  sfC2Start:     number
  sfC2ExitIdx:   number
  sfInfl:        number
}

interface IncSettings {
  jorgeFTE:        number
  graceFTE:        number
  graceHasHELP:    boolean
  taxMode:         boolean
  jorgeMonthlyNet: number
  graceMonthlyNet: number
}

interface ProjectionsClientProps {
  initialSettings:    ProjSettings
  initialJorgePhases: GracePhaseRow[]
  initialGracePhases: GracePhaseRow[]
  initialOneoffs:     OneOffRow[]
  initialLifePhases:  LifePhase[]
  initialFeeSchedule: FeeRow[]
  income:             IncSettings
  baseMonthlyExpenses: number
  mortBalance:        number
  mortRate:           number
  mortPayment:        number
  mortEndDate:        string
  cashOnHand:         number
  propValue:          number
  cryptoValue:        number
  currentYear:        number
  person1Name:        string
  person2Name:        string
}

export default function ProjectionsClient({
  initialSettings, initialJorgePhases, initialGracePhases, initialOneoffs, initialLifePhases, initialFeeSchedule,
  income, baseMonthlyExpenses,
  mortBalance, mortRate, mortPayment, mortEndDate,
  cashOnHand, propValue, cryptoValue, currentYear,
  person1Name, person2Name,
}: ProjectionsClientProps) {
  const [settings,    setSettings]    = useState<ProjSettings>(initialSettings)
  const [jorgePhases, setJorgePhases] = useState<GracePhaseRow[]>(initialJorgePhases)
  const [gracePhases, setGracePhases] = useState<GracePhaseRow[]>(initialGracePhases)
  const [feeRows,     setFeeRows]     = useState<FeeRow[]>(initialFeeSchedule)
  const [oneoffs,     setOneoffs]     = useState<OneOffRow[]>(initialOneoffs)
  const [lifePhases,  setLifePhases]  = useState<LifePhase[]>(initialLifePhases)

  const sfSchedule = useMemo<FeeSchedule>(
    () => Object.fromEntries(feeRows.map(r => [r.level, { tuition: r.tuition, fixed: r.fixed }])),
    [feeRows],
  )

  const saveFeeRow = useCallback(async (id: number, field: 'tuition' | 'fixed', value: number) => {
    setFeeRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    await fetch(`/api/school-fee-levels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tuition: feeRows.find(r => r.id === id)?.tuition ?? 0, fixed: feeRows.find(r => r.id === id)?.fixed ?? 0, [field]: value }),
    })
  }, [feeRows])

  const inputs = useMemo<ProjectionInputs>(() => ({
    jorgeFTE:             income.jorgeFTE,
    graceFTE:             income.graceFTE,
    taxMode:              income.taxMode,
    graceHasHELP:         income.graceHasHELP,
    graceHELPBalance:     income.graceHasHELP ? 50000 : 0,
    jorgeMonthlyNet:      income.jorgeMonthlyNet,
    graceMonthlyNet:      income.graceMonthlyNet,
    jorgeGrowthRate:      settings.jorgeGrowth,
    graceGrowthRate:      settings.graceGrowth,
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
    helpDebt:             income.graceHasHELP ? 50000 : 0,
    jorgePhases,
    gracePhases,
    baseMonthlyExpenses,
    oneoffs,
    schoolFeesOn:         settings.schoolFeesOn,
    sfC1Start:            settings.sfC1Start,
    sfC1ExitIdx:          settings.sfC1ExitIdx,
    sfC2Start:            settings.sfC2Start,
    sfC2ExitIdx:          settings.sfC2ExitIdx,
    sfInfl:               settings.sfInfl,
    sfSchedule:           sfSchedule,
    lifePhases,
    currentYear,
  }), [settings, jorgePhases, gracePhases, oneoffs, lifePhases, income, sfSchedule, baseMonthlyExpenses, mortBalance, mortRate, mortPayment, cashOnHand, propValue, cryptoValue, currentYear])

  const output = useMemo(() => runProjections(inputs), [inputs])
  const main   = output.withFees ?? output.base
  const sfOn   = settings.schoolFeesOn

  // ── Banner values ──
  const initNW  = propValue + cashOnHand + cryptoValue - mortBalance
  const finalNW = main.nwArr[main.nwArr.length - 1]
  const clearedIdx = main.mortArr.findIndex(v => v <= 0)
  const mortCleared = clearedIdx >= 0 ? output.labels[clearedIdx] : 'Not in period'
  const finalInvest = main.investArr[main.investArr.length - 1]
  const totalFees   = sfOn ? main.sfTotalArr.reduce((s, v) => s + v, 0) : 0
  const nwNoFeesFinal = output.base.nwArr[output.base.nwArr.length - 1]
  const nwFeeCost   = sfOn ? nwNoFeesFinal - finalNW : 0

  // ── Settings patch helper ──
  const patchSettings = useCallback(async (patch: Partial<ProjSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
    await fetch('/api/projection-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }, [])

  // ── Person1 phase CRUD ──
  const addJorgePhase = useCallback(async () => {
    const maxY = jorgePhases.length ? Math.max(...jorgePhases.map(p => p.year)) : currentYear
    const res = await fetch('/api/jorge-phases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: maxY + 2, days: 5 }),
    })
    const created: GracePhaseRow = await res.json()
    setJorgePhases(prev => [...prev, created])
  }, [jorgePhases, currentYear])

  const updateJorgePhase = useCallback(async (id: number, field: string, value: number) => {
    setJorgePhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
    await fetch(`/api/jorge-phases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }, [])

  const deleteJorgePhase = useCallback(async (id: number) => {
    setJorgePhases(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/jorge-phases/${id}`, { method: 'DELETE' })
  }, [])

  // ── Person2 phase CRUD ──
  const addGracePhase = useCallback(async () => {
    const maxY = gracePhases.length ? Math.max(...gracePhases.map(p => p.year)) : currentYear
    const res = await fetch('/api/grace-phases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: maxY + 2, days: 3 }),
    })
    const created: GracePhaseRow = await res.json()
    setGracePhases(prev => [...prev, created])
  }, [gracePhases, currentYear])

  const updateGracePhase = useCallback(async (id: number, field: string, value: number) => {
    setGracePhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
    await fetch(`/api/grace-phases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }, [])

  const deleteGracePhase = useCallback(async (id: number) => {
    setGracePhases(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/grace-phases/${id}`, { method: 'DELETE' })
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

  function Slider({ label, id, min, max, step, value, cls, fmt: fmtFn = (v: number) => v + '%' }: {
    label: string; id: string; min: number; max: number; step: number; value: number; cls: string; fmt?: (v: number) => string
  }) {
    const dec = (v: number) => patchSettings({ [id]: Math.max(min, parseFloat((v - step).toFixed(4))) } as Partial<ProjSettings>)
    const inc = (v: number) => patchSettings({ [id]: Math.min(max, parseFloat((v + step).toFixed(4))) } as Partial<ProjSettings>)
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
            onChange={e => patchSettings({ [id]: parseFloat(e.target.value) } as Partial<ProjSettings>)}
          />
          <button className="slider-btn" type="button" onClick={() => inc(value)}>+</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* ── Banner ── */}
      <div className="banner">
        <div className="b-item"><div className="b-label">Net worth in {settings.projYears} yrs</div><div className="b-value green">{fmtK(finalNW)}</div></div>
        <div className="b-div" />
        <div className="b-item"><div className="b-label">Growth</div><div className="b-value green">+{fmtK(finalNW - initNW)}</div></div>
        <div className="b-div" />
        <div className="b-item"><div className="b-label">Mortgage cleared</div><div className="b-value">{mortCleared}</div></div>
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
              <GraceIncomeChart
                labels={output.labels}
                person1Data={main.jorgeArr} person2Data={main.graceArr}
                person1Name={person1Name}   person2Name={person2Name}
                leaveYrs={main.leaveYrs}
                person1FTE={income.jorgeFTE} person2FTE={income.graceFTE}
                person1Growth={settings.jorgeGrowth} person2Growth={settings.graceGrowth}
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
            <GraceTimeline
              phases={jorgePhases} currentYear={currentYear}
              fte={income.jorgeFTE} showLeave={false}
              onUpdate={updateJorgePhase} onDelete={deleteJorgePhase} onAdd={addJorgePhase}
            />
          </Panel>

          <div style={{ marginTop: '1rem' }}>
            <Panel title={`${person2Name}'s working pattern`} dotColor="var(--pink)">
              <GraceTimeline
                phases={gracePhases} currentYear={currentYear}
                fte={income.graceFTE}
                onUpdate={updateGracePhase} onDelete={deleteGracePhase} onAdd={addGracePhase}
              />
            </Panel>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Panel title="Income & wage growth" dotColor="var(--blue)">
              <Slider label={`${person2Name} wage growth / yr`} id="graceGrowth"  min={0} max={15} step={0.5} value={settings.graceGrowth}  cls="green-t" />
              <Slider label={`${person1Name} wage growth / yr`} id="jorgeGrowth"  min={0} max={15} step={0.5} value={settings.jorgeGrowth}  cls="blue-t"  />
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

          <div style={{ marginTop: '1rem' }}>
            <Panel title="One-off home expenses" dotColor="var(--blue)">
              <OneOffPanel oneoffs={oneoffs} onAdd={addOneoff} onUpdate={updateOneoff} onDelete={deleteOneoff} />
            </Panel>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Panel
              title="Private school fees"
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
                  {/* Editable fee schedule */}
                  <details style={{ marginTop: 8 }}>
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
                  ...(income.graceHasHELP ? [{ label: 'Person2 HELP cleared', val: main.helpClearedYr ? String(main.helpClearedYr) : `Beyond ${settings.projYears}yr horizon`, color: main.helpClearedYr ? 'var(--teal)' : '' }] : []),
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
    </div>
  )
}
