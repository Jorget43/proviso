'use client'
import { useState, useMemo, useCallback } from 'react'
import { fmtK, possessive } from '@proviso/core/formatting'
import { runProjections } from '@proviso/core/projections'
import { buildProjectionInputs, superInputsFor, type ProjectionBaseline, type SuperSettingsLike } from '@proviso/core/future'
import { runHouseholdProjection } from '@proviso/core/super'
import { type FeeSchedule } from '@proviso/core/schoolFees'
import { LOCATION_OPTIONS, presetScheduleFor, presetTotalFor } from '@proviso/core/educationCosts'

interface FeeRow { id: number; level: string; tuition: number; fixed: number }
import Panel from '@/components/ui/Panel'
import ReadOnlyFence from '@/components/ui/ReadOnlyFence'
import NetWorthChart      from './NetWorthChart'
import MoneyInOutChart    from './MoneyInOutChart'
import HomeChart          from './HomeChart'
import SuperBalanceChart  from '@/components/super/SuperBalanceChart'
import SchoolFeeChart     from './SchoolFeeChart'
import WorkPhaseTimeline, { type WorkPhaseRow } from './WorkPhaseTimeline'
import OneOffPanel,       { type OneOffRow }      from './OneOffPanel'
import LifePhasesPanel                            from './LifePhasesPanel'
import NetWorthHistoryPanel, { type NetWorthSnapshotRow } from './NetWorthHistoryPanel'
import type { LifePhase } from '@proviso/core/lifephases'

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
  person1Age:        number
  person2Age:        number
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
  baseline:             ProjectionBaseline   // today's position, from @proviso/core/future
  mortRate:             number
  mortPayment:          number
  mortEndDate:          string
  currentYear:          number
  person1Name:          string
  person2Name:          string
  initialRentSettings:  RentSettingsType | null
  initialSnapshots:     NetWorthSnapshotRow[]
  /** Saved super settings, so Future can show retirement (and count super if asked). */
  superSettings:        SuperSettingsLike
  partnerEnabled:       boolean
}

type View  = 'networth' | 'inout' | 'home' | 'fees' | 'retirement'
type Group = 'basics' | 'work' | 'home' | 'plans'
const GROUPS: { key: Group; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'work',   label: 'Work' },
  { key: 'home',   label: 'Home' },
  { key: 'plans',  label: 'Plans' },
]

const DEFAULT_RENT: RentSettingsType = {
  id: 1, enabled: false, monthlyRent: 0, annualIncreaseRate: 5.0,
  purchasePlanEnabled: false, targetPurchaseYear: new Date().getFullYear() + 5,
  targetPropertyValue: 800000, depositPct: 20.0,
  depositFromCash: 0, depositFromInvestments: 0,
  newMortgageRate: 6.0, newMortgageTermYrs: 30,
}

// Declared at module level: defined inside ProjectionsClient it was a new
// component type on every render, so React remounted each slider whenever a
// value changed — which can drop an in-progress drag or keyboard focus.
function Slider({ label, hint, min, max, step, value, cls, fmt: fmtFn = (v: number) => v + '%', onChange }: {
  label: string; hint?: string; id?: string; min: number; max: number; step: number; value: number; cls: string
  fmt?: (v: number) => string; onChange: (v: number) => void
}) {
  const dec = (v: number) => onChange(Math.max(min, parseFloat((v - step).toFixed(4))))
  const inc = (v: number) => onChange(Math.min(max, parseFloat((v + step).toFixed(4))))
  return (
    <div className="slider-group">
      <div className="slider-label">
        {label} <span>{fmtFn(value)}</span>
      </div>
      {hint && <div className="slider-hint">{hint}</div>}
      <div className="slider-row">
        <button className="slider-btn" type="button" onClick={() => dec(value)} aria-label={`Decrease ${label}`}>−</button>
        <input
          type="range" className={cls} min={min} max={max} step={step} aria-label={label}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
        />
        <button className="slider-btn" type="button" onClick={() => inc(value)} aria-label={`Increase ${label}`}>+</button>
      </div>
    </div>
  )
}

export default function ProjectionsClient({
  canEdit,
  initialSettings, initialPerson1Phases, initialPerson2Phases, initialOneoffs, initialLifePhases, initialFeeSchedule,
  income, baseline, mortRate, mortPayment, mortEndDate, currentYear,
  person1Name, person2Name, initialRentSettings, initialSnapshots,
  superSettings, partnerEnabled,
}: ProjectionsClientProps) {
  const [settings,       setSettings]       = useState<ProjSettings>(initialSettings)
  const [person1Phases,  setPerson1Phases]  = useState<WorkPhaseRow[]>(initialPerson1Phases)
  const [person2Phases,  setPerson2Phases]  = useState<WorkPhaseRow[]>(initialPerson2Phases)
  const [feeRows,     setFeeRows]     = useState<FeeRow[]>(initialFeeSchedule)
  const [oneoffs,     setOneoffs]     = useState<OneOffRow[]>(initialOneoffs)
  const [lifePhases,  setLifePhases]  = useState<LifePhase[]>(initialLifePhases)
  const [rentSt,      setRentSt]      = useState<RentSettingsType>(initialRentSettings ?? DEFAULT_RENT)
  const [snapshots,   setSnapshots]   = useState<NetWorthSnapshotRow[]>(initialSnapshots)
  const [view,        setView]        = useState<View>('networth')
  const [includeSuper, setIncludeSuper] = useState(false)
  const [group,       setGroup]       = useState<Group>('basics')
  const [whatIfOpen,  setWhatIfOpen]  = useState(false)

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

  // Assembled by @proviso/core/future, the same as the app's Future screen.
  const inputs = useMemo(() => buildProjectionInputs(baseline, {
    income, settings, person1Phases, person2Phases, oneoffs, lifePhases, sfSchedule,
    rent: rentSt, mortgage: { rate: mortRate, payment: mortPayment }, currentYear,
  }), [baseline, income, settings, person1Phases, person2Phases, oneoffs, lifePhases, sfSchedule, rentSt, mortRate, mortPayment, currentYear])
  const { person1HELPBalance, person2HELPBalance, netWorthToday } = baseline

  const output = useMemo(() => runProjections(inputs), [inputs])
  const main   = output.withFees ?? output.base
  const sfOn   = settings.schoolFeesOn

  // ── Banner values ──
  const initNW  = netWorthToday
  const finalNW = main.nwArr[main.nwArr.length - 1]
  const clearedIdx = main.mortArr.findIndex(v => v <= 0)
  const mortCleared = clearedIdx >= 0 ? output.labels[clearedIdx] : 'Not in period'
  const finalInvest = main.investArr[main.investArr.length - 1]
  const totalFees   = sfOn ? main.sfTotalArr.reduce((s, v) => s + v, 0) : 0
  const nwNoFeesFinal = output.base.nwArr[output.base.nwArr.length - 1]
  const nwFeeCost   = sfOn ? nwNoFeesFinal - finalNW : 0
  const totalRentPaid = main.rentArr.reduce((s, v) => s + v, 0)

  // ── Actual net worth history, bucketed to one point per calendar year ──
  // (latest snapshot within each year; "now" falls back to the live baseline
  // until the first auto-snapshot lands, so the actual line always starts
  // continuous with where the projected line begins)
  const { historyLabels, historyData } = useMemo(() => {
    const byYear = new Map<number, number>()
    for (const s of snapshots) byYear.set(new Date(s.takenAt).getFullYear(), s.netWorth)
    if (!byYear.has(currentYear)) byYear.set(currentYear, initNW)
    const years = [...byYear.keys()].filter(y => y <= currentYear).sort((a, b) => a - b)
    return { historyLabels: years.map(String), historyData: years.map(y => byYear.get(y)!) }
  }, [snapshots, currentYear, initNW])

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
    if (!res.ok) return  // failure is reported by SaveErrorToast
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
    if (!res.ok) return  // failure is reported by SaveErrorToast
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
    if (!res.ok) return  // failure is reported by SaveErrorToast
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

  // ── Net worth snapshot CRUD ──
  const addSnapshot = useCallback(async (takenAt: string, netWorth: number) => {
    const res = await fetch('/api/net-worth-snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takenAt, netWorth }),
    })
    if (!res.ok) return  // failure is reported by SaveErrorToast
    const created: NetWorthSnapshotRow = await res.json()
    setSnapshots(prev => [...prev, created].sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()))
  }, [])

  const deleteSnapshot = useCallback(async (id: number) => {
    setSnapshots(prev => prev.filter(s => s.id !== id))
    await fetch(`/api/net-worth-snapshots/${id}`, { method: 'DELETE' })
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


  // ── Chart explorer: one chart at a time, each with a plain-language takeaway ──
  const lastLabel   = output.labels[output.labels.length - 1]
  const growth      = finalNW - initNW
  const hasLoan     = main.mortArr.some(v => v > 0)
  const hasHousing  = main.mortStressArr.some(v => v > 0)
  const deficitIdx  = main.deficitArr.flatMap((v, i) => (v < 0 ? [i] : []))
  const stressIdx   = main.mortStressArr.flatMap((v, i) => (v > 30 ? [i] : []))
  const peakStress  = Math.max(0, ...main.mortStressArr)
  const hhIncome    = main.person1Arr.map((v, i) => v + (main.person2Arr[i] ?? 0))
  const plural      = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

  // Super, year by year: the same engine and inputs as the app's Future screen
  // (@proviso/core/future), following the pay-rise sliders here.
  const superResult = useMemo(() => {
    const sup = superInputsFor(superSettings, partnerEnabled, baseline.retirementMonthly,
      { person1Age: income.person1Age, person2Age: income.person2Age, person1FTE: income.person1FTE, person2FTE: income.person2FTE },
      { person1Growth: settings.person1Growth, person2Growth: settings.person2Growth })
    return runHouseholdProjection(sup.inputs, { ...sup.ctx, startYear: currentYear })
  }, [superSettings, partnerEnabled, baseline.retirementMonthly, income, settings.person1Growth, settings.person2Growth, currentYear])
  const superByYear  = new Map(superResult.combined.map(r => [r.year, r.total]))
  const superData    = output.labels.map(l => Math.round(superByYear.get(Number(l)) ?? 0))
  const hasSuper     = superData.some(v => v > 0)
  const p1RetireYear = currentYear + (superSettings.person1RetirementAge - income.person1Age)
  const p2RetireYear = partnerEnabled ? currentYear + (superSettings.person2RetirementAge - income.person2Age) : null
  const superAtEnd   = superData[superData.length - 1] ?? 0

  const views: { key: View; label: string; takeaway: string }[] = [
    {
      key: 'networth', label: 'Net worth',
      takeaway: `By ${lastLabel} you're on track to be worth ${fmtK(finalNW)} — ${growth >= 0 ? 'up' : 'down'} ${fmtK(Math.abs(growth))} on today.`
        + (hasSuper ? (includeSuper ? ` With super counted, ${fmtK(finalNW + superAtEnd)}.` : ` Plus ${fmtK(superAtEnd)} in super, which you can't touch until about 60.`) : '')
        + (sfOn && nwFeeCost > 0 ? ` Without school fees it would be about ${fmtK(nwFeeCost)} more.` : ''),
    },
    {
      key: 'inout', label: 'Money in & out',
      takeaway: (() => {
        const worst = Math.min(...main.deficitArr)
        const wi = main.deficitArr.indexOf(worst)
        const range = `Take-home pay goes from ${fmtK(hhIncome[0] ?? 0)} to ${fmtK(hhIncome[hhIncome.length - 1] ?? 0)} a year.`
        const leave = main.leaveYrs.length ? ` ${person2Name} is on parental leave in ${main.leaveYrs.join(', ')}.` : ''
        return deficitIdx.length === 0
          ? `${range} Your income covers your spending in every year shown; the leanest is ${output.labels[wi]}, with ${fmtK(worst)} to spare.${leave}`
          : `${range} You'd spend more than you earn in ${plural(deficitIdx.length, 'year')}, starting ${output.labels[deficitIdx[0]]}; the tightest is ${output.labels[wi]}, ${fmtK(-worst)} short.${leave}`
      })(),
    },
    ...(hasLoan || hasHousing ? [{
      key: 'home' as const, label: 'Home',
      takeaway: (clearedIdx >= 0 ? `Your home loan is paid off in ${mortCleared}.` : `Your home loan isn't paid off within the ${settings.projYears} years shown.`)
        + (stressIdx.length === 0
          ? ' Repayments stay under 30% of your income, a comfortable level.'
          : ` Repayments take more than 30% of your income in ${plural(stressIdx.length, 'year')}, peaking at ${peakStress.toFixed(0)}% in ${output.labels[main.mortStressArr.indexOf(peakStress)]}.`),
    }] : []),
    ...(sfOn ? [{
      key: 'fees' as const, label: 'School fees',
      takeaway: (() => {
        const peak = Math.max(0, ...main.sfTotalArr)
        return `School fees add up to ${fmtK(totalFees)}, peaking at ${fmtK(peak)} in ${output.labels[main.sfTotalArr.indexOf(peak)]}.`
      })(),
    }] : []),
    ...(hasSuper ? [{
      key: 'retirement' as const, label: 'Retirement',
      takeaway: (superResult.combinedDepletionAge === null
        ? `Super should pay ${fmtK(superResult.monthlyIncomeGoal)} a month (in today's money) past age 100.`
        : `Super would pay ${fmtK(superResult.monthlyIncomeGoal)} a month (in today's money) until age ${superResult.combinedDepletionAge}.`)
        + ` Retirement from ${p1RetireYear}${p2RetireYear ? ` and ${p2RetireYear}` : ''}. Doesn't count the Age Pension or savings outside super.`,
    }] : []),
  ]
  const current = views.find(v => v.key === view) ?? views[0]

  function openWhatIf() {
    setWhatIfOpen(true)
    document.getElementById('explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={`page proj${whatIfOpen ? ' whatif-open' : ''}`}>
      <section className="proj-headline">
        <p className="proj-lede">
          In {lastLabel}, you&rsquo;re on track to be worth <strong className={finalNW < 0 ? 'neg' : undefined}>{fmtK(finalNW)}</strong>.
        </p>
        <p className="proj-lede-sub">
          {hasLoan && (clearedIdx >= 0 ? `Home loan paid off in ${mortCleared}. ` : 'Home loan still being paid off. ')}
          {rentSt.enabled && `${fmtK(totalRentPaid)} paid in rent along the way. `}
          {deficitIdx.length > 0 ? `${plural(deficitIdx.length, 'tight year')} where spending beats income.` : 'No years where spending beats income.'}
        </p>
      </section>

      <div className="sidebar-layout">
        {/* ── Main column ── */}
        <div className="proj-main">
          <section className="panel explorer" id="explorer">
            <div className="explorer-tabs" role="tablist" aria-label="Choose a chart">
              {views.map(v => (
                <button key={v.key} type="button" role="tab" aria-selected={current.key === v.key}
                  className={`explorer-tab${current.key === v.key ? ' active' : ''}`}
                  onClick={() => setView(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="panel-body">
              <p className="explorer-takeaway">{current.takeaway}</p>
              {current.key === 'networth' && (
                <>
                  {hasSuper && (
                    <label className="super-toggle">
                      <input type="checkbox" checked={includeSuper} onChange={e => setIncludeSuper(e.target.checked)} />
                      <span className="super-toggle-text">Count super in net worth<small>You can&rsquo;t use it until about 60, so it&rsquo;s left out unless you ask.</small></span>
                    </label>
                  )}
                  <NetWorthChart
                    labels={output.labels} nwData={main.nwArr} nwNoFees={sfOn ? output.base.nwArr : null}
                    investData={main.investArr} cashData={main.cashArr} sfOn={sfOn}
                    historyLabels={historyLabels} historyData={historyData}
                    superData={hasSuper ? superData : null} includeSuper={includeSuper}
                  />
                </>
              )}
              {current.key === 'inout' && (
                <MoneyInOutChart
                  labels={output.labels} person1Data={main.person1Arr} person2Data={main.person2Arr}
                  person1Name={person1Name} person2Name={person2Name} showPerson2={partnerEnabled}
                  leaveYrs={main.leaveYrs} spendData={main.expArr} sfTotalData={sfOn ? main.sfTotalArr : main.sfTotalArr.map(() => 0)}
                  phaseData={main.phaseArr} cashData={main.cashRunningArr}
                />
              )}
              {current.key === 'home' && (
                <HomeChart labels={output.labels} mortData={main.mortArr} stressData={main.mortStressArr} rentData={main.rentArr} endDate={mortEndDate} />
              )}
              {current.key === 'retirement' && (
                <SuperBalanceChart
                  combined={superResult.combined}
                  person1Rows={superResult.person1.rows}
                  person2Rows={superResult.person2?.rows ?? null}
                  person1RetirementYear={p1RetireYear}
                  person2RetirementYear={p2RetireYear}
                  person1Name={person1Name}
                  person2Name={person2Name}
                />
              )}
              {current.key === 'fees' && (
                <SchoolFeeChart
                  labels={output.labels} sfC1Arr={main.sfC1Arr} sfC2Arr={main.sfC2Arr}
                  sfSibArr={main.sfSibArr} sfTotalArr={main.sfTotalArr}
                  sfC1Start={settings.sfC1Start} sfC1ExitIdx={settings.sfC1ExitIdx}
                  sfC2Start={settings.sfC2Start} sfC2ExitIdx={settings.sfC2ExitIdx}
                />
              )}
            </div>
          </section>

          <Panel title="The numbers" dotColor="var(--purple)">
            <div className="proj-summary">
              {[
                { label: 'Net worth today',           val: fmtK(initNW),  color: '' },
                { label: `Net worth in ${lastLabel}`, val: fmtK(finalNW), color: 'var(--green)' },
                ...(sfOn ? [
                  { label: 'Without school fees',  val: fmtK(nwNoFeesFinal), color: '' },
                  { label: 'School fees in total', val: fmtK(totalFees),     color: 'var(--red)' },
                ] : []),
                { label: `Cash in ${lastLabel}`,        val: fmtK(main.cashArr[main.cashArr.length - 1]), color: '' },
                { label: `Investments in ${lastLabel}`, val: fmtK(finalInvest), color: 'var(--purple)' },
                ...(hasLoan ? [{ label: `Home loan left in ${lastLabel}`, val: fmtK(main.mortArr[main.mortArr.length - 1]), color: 'var(--red)' }] : []),
                { label: 'Spending today', val: '$' + Math.round(baseline.budgetMonthlyExpenses).toLocaleString('en-AU') + '/mo', color: '' },
                ...(main.leaveYrs.length ? [{ label: 'Parental leave', val: main.leaveYrs.join(', '), color: 'var(--pink)' }] : []),
                ...(person1HELPBalance > 0 ? [{ label: `${possessive(person1Name)} HELP debt cleared`, val: main.person1HelpClearedYr ? String(main.person1HelpClearedYr) : `After ${lastLabel}`, color: main.person1HelpClearedYr ? 'var(--teal)' : '' }] : []),
                ...(person2HELPBalance > 0 ? [{ label: `${possessive(person2Name)} HELP debt cleared`, val: main.person2HelpClearedYr ? String(main.person2HelpClearedYr) : `After ${lastLabel}`, color: main.person2HelpClearedYr ? 'var(--teal)' : '' }] : []),
              ].map(({ label, val, color }) => (
                <div key={label} className="proj-summary-row">
                  <span>{label}</span>
                  <strong style={{ color: color || undefined }}>{val}</strong>
                </div>
              ))}
            </div>
          </Panel>

          <ReadOnlyFence canEdit={canEdit}>
            <Panel title="Track your actual net worth" dotColor="var(--amber)">
              <NetWorthHistoryPanel snapshots={snapshots} onAdd={addSnapshot} onDelete={deleteSnapshot} />
            </Panel>
          </ReadOnlyFence>
        </div>

        {/* ── What if? — the sidebar on desktop, a half-height drawer on phones ── */}
        <aside className={`whatif${whatIfOpen ? ' open' : ''}`} data-group={group} aria-label="What if? settings">
          <div className="whatif-head">
            <div className="whatif-title">
              <strong>What if?</strong>
              <button type="button" className="sheet-close" onClick={() => setWhatIfOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="whatif-tabs" role="tablist">
              {GROUPS.map(g => (
                <button key={g.key} type="button" role="tab" aria-selected={group === g.key}
                  className={`whatif-tab${group === g.key ? ' active' : ''}`} onClick={() => setGroup(g.key)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="whatif-body">
          <ReadOnlyFence canEdit={canEdit}>
          <div className="wi-group" data-group="basics">
            <Panel title="The basics" dotColor="var(--amber)">
              <Slider label="Years to look ahead" min={5} max={40} step={1} value={settings.projYears} cls="amber-t" fmt={v => v + ' yrs'} onChange={v => patchSettings({ projYears: v })} />
              <Slider label={`${possessive(person1Name)} pay rise each year`} min={0} max={15} step={0.5} value={settings.person1Growth} cls="blue-t" onChange={v => patchSettings({ person1Growth: v })} />
              {income.person2FTE > 0 && (
                <Slider label={`${possessive(person2Name)} pay rise each year`} min={0} max={15} step={0.5} value={settings.person2Growth} cls="green-t" onChange={v => patchSettings({ person2Growth: v })} />
              )}
              <Slider label="Leftover money you invest" hint="The rest stays as cash." min={0} max={100} step={5} value={settings.savingsRate} cls="purple-t" onChange={v => patchSettings({ savingsRate: v })} />
              <Slider label="Investment growth each year" min={0} max={15} step={0.5} value={settings.investReturn} cls="purple-t" onChange={v => patchSettings({ investReturn: v })} />
              <details className="wi-more">
                <summary>More assumptions</summary>
                <Slider label={`Price rises, ${currentYear}–${String(currentYear + 2).slice(2)}`} min={0} max={10} step={0.5} value={settings.expInflNear} cls="red-t" onChange={v => patchSettings({ expInflNear: v })} />
                <Slider label="Price rises after that" min={0} max={8} step={0.5} value={settings.expInfl} cls="red-t" onChange={v => patchSettings({ expInfl: v })} />
                <Slider label="Childcare price rises" min={0} max={15} step={0.5} value={settings.childcareInfl} cls="pink-t" onChange={v => patchSettings({ childcareInfl: v })} />
                <Slider label="Property value growth" min={0} max={12} step={0.5} value={settings.propGrowth} cls="amber-t" onChange={v => patchSettings({ propGrowth: v })} />
              </details>
            </Panel>
          </div>

          <div className="wi-group" data-group="work">
            <Panel title={`${possessive(person1Name)} work`} dotColor="var(--blue)">
              <WorkPhaseTimeline
                phases={person1Phases} currentYear={currentYear}
                fte={income.person1FTE} showLeave={false}
                onUpdate={updatePerson1Phase} onDelete={deletePerson1Phase} onAdd={addPerson1Phase}
              />
            </Panel>
            <Panel
              title={`${possessive(person2Name)} work`}
              dotColor="var(--pink)"
              right={
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--t2)', cursor: 'pointer' }}>
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

          <div className="wi-group" data-group="home">
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
                      color: rentSt.enabled === (mode === 'Renter') ? 'var(--on-accent)' : 'var(--t2)',
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

          <div className="wi-group" data-group="plans">
            <Panel title="Big one-off costs" dotColor="var(--blue)">
              <OneOffPanel oneoffs={oneoffs} onAdd={addOneoff} onUpdate={updateOneoff} onDelete={deleteOneoff} />
            </Panel>
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
                                color: !isCustom && sfType === t ? 'var(--on-accent)' : 'var(--t2)',
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
                              color: isCustom ? 'var(--on-accent)' : 'var(--t2)',
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
                    <Slider label="Fee inflation / yr" id="sfInfl" min={0} max={10} step={0.5} value={settings.sfInfl} cls="teal-t" onChange={v => patchSettings({ sfInfl: v })} />
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
            <Panel
              title="Life stage costs"
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
          </ReadOnlyFence>
          </div>
        </aside>
      </div>

      {!whatIfOpen && (
        <button type="button" className="whatif-fab" onClick={openWhatIf}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
          </svg>
          What if?
        </button>
      )}
    </div>
  )
}
