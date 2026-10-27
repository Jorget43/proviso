'use client'
import { useState, useMemo, useCallback, useDeferredValue } from 'react'
import { fmt, fmtK, possessive } from '@proviso/core/formatting'
import { runProjections, type ProjectionResult } from '@proviso/core/projections'
import { runOutlook, planInputs, mixFrom, rangeOn, chanceWords, MIX_CHOICES } from '@proviso/core/uncertainty'
import { DEFAULT_CASH_RATE, DEFAULT_DIVIDEND_YIELD, DEFAULT_FRANKED_PCT, DEFAULT_PERSON1_SHARE } from '@proviso/core/investmentIncome'
import { runScenarios, summariseRun, readOverrides, validOverrides, patchOverrides, writeOverrides, countChanges, scenarioColour, type ScenarioOverrides, type OverrideSection, type ScenarioSummary } from '@proviso/core/scenarios'
import { buildProjectionInputs, type ProjectionBaseline, type SuperSettingsLike } from '@proviso/core/future'
import { asDrawdownStrategy, DRAWDOWN_CHOICES, PRESERVATION_AGE, DEFAULT_HORIZON_AGE } from '@proviso/core/retirement'
import { type FeeSchedule } from '@proviso/core/schoolFees'
import { LOCATION_OPTIONS, presetScheduleFor, presetTotalFor } from '@proviso/core/educationCosts'
import { childLabel, sortChildren } from '@proviso/core/people'
import type { PackagedItemLike } from '@proviso/core/packaging'
import type { SchoolChoice } from '@proviso/core/schoolFees'

interface FeeRow { id: number; level: string; tuition: number; fixed: number }
import Panel from '@/components/ui/Panel'
import ReadOnlyFence from '@/components/ui/ReadOnlyFence'
import NetWorthChart      from './NetWorthChart'
import MoneyInOutChart, { signed } from './MoneyInOutChart'
import { leftOver as leftOverOf, workingYears, tightWorkingYears, stressYears, MORTGAGE_STRESS_PCT } from '@proviso/core/yearByYear'
import HomeChart          from './HomeChart'
import RetirementChart    from './RetirementChart'
import SchoolFeeChart     from './SchoolFeeChart'
import WorkPhaseTimeline, { type WorkPhaseRow } from './WorkPhaseTimeline'
import OneOffPanel,       { type OneOffRow }      from './OneOffPanel'
import LifePhasesPanel                            from './LifePhasesPanel'
import LifeStagesPanel, { type ChildRow }         from './LifeStagesPanel'
import NetWorthHistoryPanel, { type NetWorthSnapshotRow } from './NetWorthHistoryPanel'
import type { LifePhase } from '@proviso/core/lifephases'
import type { Overlay } from '@/lib/scenarioOverlay'

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
  horizonAge:    number
  cashBufferMonths: number
  funPct:        number
  lifeStagesOn:  boolean
  sfSib2Pct:     number
  sfSib3Pct:     number
  sfSib4Pct:     number
  sfFamilyFee:   number
  sfEntryFee:    number
  returnSpread:  number
  showRange?:      boolean | null
  growthPct?:      number
  glidePath?:      boolean
  glideTargetPct?: number
  dividendYield?:      number
  frankedPct?:         number
  cashRate?:           number
  person1InvestShare?: number
  childLeavesHomeAge: number
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
  stampDutyPct:          number
}

export interface ScenarioRow { id: number; name: string; colour: string; enabled: boolean; overrides: string }

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
  initialChildren:      ChildRow[]
  /** Salary packaging items (edited on Budget). */
  packaging:            PackagedItemLike[]
  initialRegional:      boolean
  /** Where the household lives (a state key), for typical school fees. */
  initialState:         string | null
  initialScenarios:     ScenarioRow[]
}

type View  = 'networth' | 'inout' | 'home' | 'fees' | 'retirement'
type Group = 'basics' | 'work' | 'family' | 'home' | 'plans'
const GROUPS: { key: Group; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'work',   label: 'Work' },
  { key: 'family', label: 'Family' },
  { key: 'home',   label: 'Home' },
  { key: 'plans',  label: 'Plans' },
]

const SCHOOL_LABEL: Record<SchoolChoice, string> = {
  government: 'Government', catholic: 'Catholic', independent: 'Independent', custom: 'Your own fees', none: 'Not counted',
}

const DEFAULT_RENT: RentSettingsType = {
  id: 1, enabled: false, monthlyRent: 0, annualIncreaseRate: 5.0,
  purchasePlanEnabled: false, targetPurchaseYear: new Date().getFullYear() + 5,
  targetPropertyValue: 800000, depositPct: 20.0,
  depositFromCash: 0, depositFromInvestments: 0,
  newMortgageRate: 6.0, newMortgageTermYrs: 30, stampDutyPct: 4.0,
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
  superSettings, partnerEnabled, initialChildren, initialRegional, initialState, initialScenarios, packaging,
}: ProjectionsClientProps) {
  const [children,       setChildren]       = useState<ChildRow[]>(initialChildren)
  const [regional,       setRegional]       = useState(initialRegional)
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
  const [sup,         setSup]         = useState<SuperSettingsLike>(superSettings)
  const [group,       setGroup]       = useState<Group>('basics')
  const [whatIfOpen,  setWhatIfOpen]  = useState(false)
  const [scenarios,   setScenarios]   = useState<ScenarioRow[]>(initialScenarios)
  /** The scenario What if? is changing, or null for the plan itself. */
  const [editing,     setEditing]     = useState<number | null>(null)

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

  const ownSchedule = useMemo<FeeSchedule>(() => Object.fromEntries(feeRows.map(r => [r.level, { tuition: r.tuition, fixed: r.fixed }])), [feeRows])
  // Assembled by @proviso/core/future, the same as the app's Future screen.
  const live = useMemo(() => ({
    income, settings, person1Phases, person2Phases, oneoffs, lifePhases, sfSchedule,
    rent: rentSt, mortgage: { rate: mortRate, payment: mortPayment }, currentYear,
    life: { partnerEnabled, person1Age: income.person1Age, person2Age: income.person2Age, super: sup },
    children, regional, state: initialState, ownSchedule, packaging,
  }), [income, settings, person1Phases, person2Phases, oneoffs, lifePhases, sfSchedule, rentSt, mortRate, mortPayment, currentYear, partnerEnabled, sup, children, regional, initialState, ownSchedule, packaging])
  const inputs = useMemo(() => buildProjectionInputs(baseline, live), [baseline, live])
  // Scenarios run through the same engine, layered on the plan (@proviso/core/scenarios).
  const runs = useMemo(() => runScenarios(baseline, live, scenarios, ownSchedule), [baseline, live, scenarios, ownSchedule])
  const { person1HELPBalance, person2HELPBalance, netWorthToday } = baseline

  // The plan (glide path applied when on), then a few hundred runs with
  // returns rising and falling for the range (@proviso/core/uncertainty).
  // The runs follow a moment behind, so sliders stay smooth.
  const mix     = useMemo(() => mixFrom(settings), [settings])
  const showing = rangeOn(settings)
  const output  = useMemo(() => runProjections(planInputs(inputs, mix)), [inputs, mix])
  const lagging = useDeferredValue({ inputs, mix, showing })
  const outlook = useMemo(() => runOutlook(lagging.inputs, lagging.mix, lagging.showing, currentYear, income.person1Age),
    [lagging, currentYear, income.person1Age])
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
  const totalFun      = main.funArr.reduce((s, v) => s + v, 0)

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

  const patchSuper = useCallback(async (patch: Partial<SuperSettingsLike>) => {
    setSup(prev => ({ ...prev, ...patch }))
    await fetch('/api/super-settings', {
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
  // ── Children and where you live (life stages) ──
  const saveRegional = useCallback(async (value: boolean) => {
    setRegional(value)
    await fetch('/api/household', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regional: value }) })
  }, [])
  const addChild = useCallback(async () => {
    const res = await fetch('/api/children', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ birthYear: currentYear + 1 }) })
    if (res.ok) { const c = await res.json() as ChildRow; setChildren(prev => [...prev, c]) }
  }, [currentYear])
  const updateChild = useCallback(async (id: number, patch: Partial<Omit<ChildRow, 'id'>>) => {
    setChildren(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    await fetch(`/api/children/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
  }, [])
  const deleteChild = useCallback(async (id: number) => {
    setChildren(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/children/${id}`, { method: 'DELETE' })
  }, [])

  const toggleLifePhase = useCallback(async (id: number, enabled: boolean) => {
    setLifePhases(prev => prev.map(p => p.id === id ? { ...p, enabled } : p))
    await fetch(`/api/life-phases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  }, [])


  // ── Scenarios: named sets of changes layered on the plan ──
  const saveScenario = useCallback(async (id: number, patch: Partial<Omit<ScenarioRow, 'id'>>) => {
    setScenarios(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
    await fetch(`/api/scenarios/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
  }, [])

  const newScenario = useCallback(async () => {
    const res = await fetch('/api/scenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Scenario ${scenarios.length + 1}` }) })
    if (!res.ok) return  // failure is reported by SaveErrorToast
    const created = await res.json() as ScenarioRow
    setScenarios(prev => [...prev, created])
    setEditing(created.id)
  }, [scenarios.length])

  const deleteScenario = useCallback(async (id: number) => {
    if (!confirm('Delete this scenario? Your plan isn’t affected.')) return
    setScenarios(prev => prev.filter(x => x.id !== id))
    setEditing(null)
    await fetch(`/api/scenarios/${id}`, { method: 'DELETE' })
  }, [])

  // Only Adults with edit rights store a chip's state; others switch it for themselves.
  const toggleShown = useCallback((x: ScenarioRow) => {
    if (canEdit) saveScenario(x.id, { enabled: !x.enabled })
    else setScenarios(prev => prev.map(y => y.id === x.id ? { ...y, enabled: !y.enabled } : y))
  }, [canEdit, saveScenario])

  /** Applies a change to the scenario being edited (computed from the latest state, so quick slider moves aren't lost). */
  const changeScenario = useCallback((patch: { [K in OverrideSection]?: ScenarioOverrides[K] | null }) => {
    if (editing === null) return
    setScenarios(prev => prev.map(x => {
      if (x.id !== editing) return x
      const overrides = writeOverrides(patchOverrides(readOverrides(x.overrides), patch))
      fetch(`/api/scenarios/${x.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overrides }) })
      return { ...x, overrides }
    }))
  }, [editing])

  // What if? shows and changes `ed`: the plan, or the plan with the edited scenario on top.
  const editingSc  = scenarios.find(x => x.id === editing) ?? null
  const editingRun = runs.find(r => r.scenario.id === editing) ?? null
  const ov         = useMemo(() => (editingSc ? validOverrides(readOverrides(editingSc.overrides)) : null), [editingSc])
  const withIds    = <T,>(list: T[]) => list.map((r, i) => ({ ...r, id: i }))
  const ed = {
    settings:      { ...settings, ...ov?.settings } as ProjSettings,
    sup:           { ...sup, ...ov?.super } as SuperSettingsLike,
    rent:          { ...rentSt, ...ov?.rent } as RentSettingsType,
    person1Phases: ov?.person1Phases ? withIds(ov.person1Phases) : person1Phases,
    person2Phases: ov?.person2Phases ? withIds(ov.person2Phases) : person2Phases,
    oneoffs:       ov?.oneoffs ? withIds(ov.oneoffs) : oneoffs,
    children:      ov?.children ? withIds(ov.children) : children,
  }
  const editSettings = useCallback((patch: Partial<ProjSettings>) => (editing === null ? patchSettings(patch) : changeScenario({ settings: patch })), [editing, patchSettings, changeScenario])
  const editSuper    = useCallback((patch: Partial<SuperSettingsLike>) => (editing === null ? patchSuper(patch) : changeScenario({ super: patch })), [editing, patchSuper, changeScenario])
  const editRent     = useCallback((patch: Partial<RentSettingsType>) => (editing === null ? patchRent(patch) : changeScenario({ rent: patch })), [editing, patchRent, changeScenario])

  // A scenario's lists (work changes, one-offs, children) are stored whole: each edit saves the full list.
  type ListSection = 'person1Phases' | 'person2Phases' | 'oneoffs' | 'children'
  function scenarioList<R extends { id: number }>(section: ListSection, rows: R[], make: () => Omit<R, 'id'>) {
    const save = (next: R[]) => changeScenario({ [section]: next.map(({ id, ...r }) => { void id; return r }) } as never)
    return {
      add:    () => save([...rows, { ...make(), id: -1 } as R]),
      update: (id: number, patch: Partial<R>) => save(rows.map(r => (r.id === id ? { ...r, ...patch } : r))),
      remove: (id: number) => save(rows.filter(r => r.id !== id)),
    }
  }
  const nextYear = (rows: { year: number }[]) => (rows.length ? Math.max(...rows.map(r => r.year)) : currentYear) + 2
  const sc = editing === null ? null : {
    p1:   scenarioList('person1Phases', ed.person1Phases, () => ({ year: nextYear(ed.person1Phases), days: 5 })),
    p2:   scenarioList('person2Phases', ed.person2Phases, () => ({ year: nextYear(ed.person2Phases), days: 3 })),
    one:  scenarioList('oneoffs', ed.oneoffs, () => ({ name: 'New expense', amt: 0, year: currentYear + 1 })),
    kids: scenarioList('children', ed.children, () => ({ name: null, birthYear: currentYear + 1, birthMonth: null })),
  }
  const parseOneOff = (field: string, value: string | number) =>
    field === 'name' ? String(value) : field === 'year' ? parseInt(String(value)) : parseFloat(String(value)) || 0
  const edMain = editingRun ? (editingRun.output.withFees ?? editingRun.output.base) : main
  // Lists keyed by length too: rows are numbered by position, so a removal re-mounts the inputs.
  const listKey = (rows: unknown[]) => `${editing ?? 'plan'}-${editing === null ? '' : rows.length}`

  // ── Chart explorer: one chart at a time, each with a plain-language takeaway ──
  const lastLabel   = output.labels[output.labels.length - 1]
  const growth      = finalNW - initNW
  const hasLoan     = main.mortArr.some(v => v > 0)
  const hasHousing  = main.mortStressArr.some(v => v > 0)
  // Tight years are counted while someone still works: once everyone has
  // retired, living off super and savings is the plan, not a shortfall.
  const retiredIdx  = main.retiredArr.indexOf(true)
  const workingEnd  = workingYears(main)
  const deficitIdx  = tightWorkingYears(main)
  const stressIdx   = stressYears(main)
  const peakStress  = Math.max(0, ...main.mortStressArr)
  const hhIncome    = main.person1Arr.map((v, i) => v + (main.person2Arr[i] ?? 0))
  const plural      = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

  // Super and retirement come from the same projection (the life course in
  // @proviso/core/projections), so every Future chart tells one story.
  const superData    = main.superArr
  const hasSuper     = superData.some(v => v > 0)
  const superAtEnd   = superData[superData.length - 1] ?? 0
  const ageIn        = (age: number, year: number) => age + (year - currentYear)
  const p1RetireYear = main.person1RetireYr ?? currentYear
  const p2RetireYear = main.person2RetireYr
  const lastRetireYr = Math.max(p1RetireYear, p2RetireYear ?? 0)
  const strategy     = asDrawdownStrategy(sup.drawdownStrategy)
  // The range's edges, on the same basis as what each chart shows.
  const endLow  = outlook.endNetWorth.low
  const endHigh = outlook.endNetWorth.high
  const nwBand  = outlook.on ? (includeSuper && hasSuper ? outlook.netWorthWithSuper : outlook.netWorth) : null
  const retirementTakeaway = (() => {
    const lasts = main.shortfallYr
      ? `Money runs short from ${main.shortfallYr}, when ${partnerEnabled ? `${person1Name} is` : 'you are'} ${ageIn(income.person1Age, main.shortfallYr)}.`
      : `Your money lasts to ${lastLabel}${partnerEnabled ? '' : `, when you're ${ageIn(income.person1Age, Number(lastLabel))}`}.`
    const bridge = main.bridgeShortYr
      ? ` Before super can be reached at ${PRESERVATION_AGE}, savings outside super run out in ${main.bridgeShortYr}.`
      : ''
    const when = lastRetireYr > currentYear
      ? ` Retiring in ${p1RetireYear}${p2RetireYear ? ` and ${p2RetireYear}` : ''}.`
      : ''
    const weaker = outlook.on && outlook.chanceLasts !== null
      ? ` With returns rising and falling, it lasts in ${chanceWords(outlook.chanceLasts)} runs`
        + (outlook.shortAgeLow !== null ? `; in the worst 1 in 10 it runs short around age ${outlook.shortAgeLow}.` : '.')
      : ''
    return `${lasts}${weaker}${bridge}${when} Doesn't count the Age Pension.`
  })()

  // ── Scenarios on the charts: the ones switched on, plus the one being edited ──
  const shownRuns = runs.filter(r => r.scenario.enabled || r.scenario.id === editing)
  const resultOf  = (r: (typeof runs)[number]) => r.output.withFees ?? r.output.base
  const overlays  = (pick: (x: ProjectionResult) => number[], readouts?: (x: ProjectionResult) => Overlay['readouts']): Overlay[] =>
    shownRuns.map(r => ({ label: r.scenario.name, colour: r.colour, data: pick(resultOf(r)), readouts: readouts?.(resultOf(r)) }))
  const leftOver  = (x: ProjectionResult) => leftOverOf(x, partnerEnabled)
  const feesInAny = sfOn || shownRuns.some(r => r.live.settings.schoolFeesOn)

  // The Compare card: the plan, then every scenario.
  const compareRows: { key: string; name: string; colour: string | null; s: ScenarioSummary; changes: number }[] = scenarios.length ? [
    { key: 'plan', name: 'Your plan', colour: null, s: summariseRun(output, live), changes: 0 },
    ...runs.map(r => ({ key: String(r.scenario.id), name: r.scenario.name, colour: r.colour, s: summariseRun(r.output, r.live),
      changes: countChanges(validOverrides(readOverrides(r.scenario.overrides))) })),
  ] : []
  const compareFees = compareRows.some(r => r.s.schoolFees > 0)
  // The school-fee chart's children: the ones still at or before school, eldest first, as the engine has them.
  const schoolKidsNow = sortChildren(children).filter(k => currentYear - k.birthYear <= 17)
  const feeChildNames = children.length
    ? schoolKidsNow.map(k => childLabel(k, sortChildren(children).indexOf(k) + 1))
    : ['Child 1', 'Child 2']

  const views: { key: View; label: string; takeaway: string }[] = [
    {
      key: 'networth', label: 'Net worth',
      takeaway: `By ${lastLabel} you're on track to be worth ${fmtK(finalNW)} — ${growth >= 0 ? 'up' : 'down'} ${fmtK(Math.abs(growth))} on today.`
        + (hasSuper ? (includeSuper ? ` With super counted, ${fmtK(finalNW + superAtEnd)}.` : ` Plus ${fmtK(superAtEnd)} in super, which you can't touch until about 60.`) : '')
        + (sfOn && nwFeeCost > 0 ? ` Without school fees it would be about ${fmtK(nwFeeCost)} more.` : '')
        + (outlook.on ? ` In 8 of 10 runs with returns rising and falling: ${fmtK(endLow)} to ${fmtK(endHigh)}.` : ''),
    },
    {
      key: 'inout', label: 'Money in & out',
      takeaway: (() => {
        const working = main.deficitArr.slice(0, workingEnd)
        const worst = Math.min(...working)
        const wi = working.indexOf(worst)
        const lastPaid = Math.max(0, workingEnd - 1)
        const range = `Take-home pay goes from ${fmtK(hhIncome[0] ?? 0)} to ${fmtK(hhIncome[lastPaid] ?? 0)} a year${retiredIdx >= 0 ? ` by ${output.labels[lastPaid]}` : ''}.`
        const leave = main.leaveYrs.length ? ` ${person2Name} is on parental leave in ${main.leaveYrs.join(', ')}.` : ''
        const retired = retiredIdx > 0 ? ` From ${output.labels[retiredIdx]} you live on super and savings.` : ''
        if (working.length === 0) return `You live on super and savings in every year shown.${leave}`
        return (deficitIdx.length === 0
          ? `${range} Your income covers your spending in every working year; the leanest is ${output.labels[wi]}, with ${fmtK(worst)} to spare.`
          : `${range} You'd spend more than you earn in ${plural(deficitIdx.length, 'working year')}, starting ${output.labels[deficitIdx[0]]}; the tightest is ${output.labels[wi]}, ${fmtK(-worst)} short.`) + retired + leave
      })(),
    },
    ...(hasLoan || hasHousing ? [{
      key: 'home' as const, label: 'Home',
      takeaway: (clearedIdx >= 0 ? `Your home loan is paid off in ${mortCleared}.` : `Your home loan isn't paid off by ${lastLabel}.`)
        + (stressIdx.length === 0
          ? ` Repayments stay under ${MORTGAGE_STRESS_PCT}% of your income, a comfortable level.`
          : ` Repayments take more than ${MORTGAGE_STRESS_PCT}% of your income in ${plural(stressIdx.length, 'year')}, peaking at ${peakStress.toFixed(0)}% in ${output.labels[main.mortStressArr.indexOf(peakStress)]}.`),
    }] : []),
    ...(feesInAny ? [{
      key: 'fees' as const, label: 'School fees',
      takeaway: (() => {
        if (!sfOn) return 'Your plan leaves school fees out. The dashed lines are scenarios that include them.'
        const peak = Math.max(0, ...main.sfTotalArr)
        return `School fees add up to ${fmtK(totalFees)}, peaking at ${fmtK(peak)} in ${output.labels[main.sfTotalArr.indexOf(peak)]}.`
      })(),
    }] : []),
    ...(hasSuper ? [{
      key: 'retirement' as const, label: 'Retirement',
      takeaway: retirementTakeaway,
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
        {outlook.on && (
          <p className="proj-lede-range">
            In 8 of 10 runs, somewhere between {fmtK(endLow)} and {fmtK(endHigh)}, depending on how investments do.
            {outlook.chanceLasts !== null && ` Money lasts to the end in ${chanceWords(outlook.chanceLasts)} runs.`}
          </p>
        )}
        <p className="proj-lede-sub">
          {hasLoan && (clearedIdx >= 0 ? `Home loan paid off in ${mortCleared}. ` : 'Home loan still being paid off. ')}
          {rentSt.enabled && `${fmtK(totalRentPaid)} paid in rent along the way. `}
          {totalFun > 0 && `${fmtK(totalFun)} spent on fun along the way. `}
          {deficitIdx.length > 0 ? `${plural(deficitIdx.length, 'tight year')} where spending beats income while you work.` : 'No working years where spending beats income.'}
          {main.shortfallYr ? ` Money runs short in retirement from ${main.shortfallYr}.` : ''}
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
              {scenarios.length > 0 && (
                <div className="scenario-chips" role="group" aria-label="Scenarios shown on the chart">
                  <span className="scenario-chip plan"><i className="chip-line" />Your plan</span>
                  {runs.map(r => {
                    const on = r.scenario.enabled || r.scenario.id === editing
                    return (
                      <button key={r.scenario.id} type="button" className={`scenario-chip${on ? ' on' : ''}`} aria-pressed={on}
                        disabled={r.scenario.id === editing} title={r.scenario.id === editing ? 'Shown while you change it' : undefined}
                        onClick={() => toggleShown(r.scenario)}>
                        <i className="chip-line dashed" style={{ borderColor: `var(--${r.colour})` }} />{r.scenario.name}
                      </button>
                    )
                  })}
                </div>
              )}
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
                    overlays={overlays(x => (includeSuper && hasSuper ? x.nwArr.map((v, i) => v + (x.superArr[i] ?? 0)) : x.nwArr))}
                    band={nwBand}
                  />
                </>
              )}
              {current.key === 'inout' && (
                <MoneyInOutChart
                  labels={output.labels} person1Data={main.person1Arr} person2Data={main.person2Arr}
                  person1Name={person1Name} person2Name={person2Name} showPerson2={partnerEnabled}
                  leaveYrs={main.leaveYrs} spendData={main.expArr} sfTotalData={sfOn ? main.sfTotalArr : main.sfTotalArr.map(() => 0)}
                  phaseData={main.phaseArr} cashData={main.cashRunningArr} superData={main.superDrawArr} investData={main.investIncArr}
                  overlays={overlays(x => x.expArr, x => [{ label: 'Left over (or short)', data: leftOver(x), compareTo: leftOver(main), format: signed }])}
                />
              )}
              {current.key === 'home' && (
                <HomeChart labels={output.labels} mortData={main.mortArr} stressData={main.mortStressArr} rentData={main.rentArr} endDate={mortEndDate} overlays={overlays(x => x.mortArr)} />
              )}
              {current.key === 'retirement' && (
                <>
                  <RetirementChart
                    labels={output.labels}
                    super1={main.super1Arr} super2={partnerEnabled ? main.super2Arr : null}
                    outside={main.investArr.map((v, i) => v + main.cashArr[i])}
                    drawn={main.superDrawArr}
                    person1Name={person1Name} person2Name={person2Name}
                    marks={[p1RetireYear, ...(p2RetireYear ? [p2RetireYear] : [])]}
                    overlays={overlays(x => x.superArr)}
                    band={outlook.on ? outlook.super : null}
                  />
                  <ReadOnlyFence canEdit={canEdit}>
                    <fieldset className="drawdown-choice">
                      <legend>How you&rsquo;d pay for retirement</legend>
                      <div className="drawdown-options">
                        {DRAWDOWN_CHOICES.map(o => (
                          <button key={o.key} type="button" aria-pressed={strategy === o.key}
                            className={`drawdown-option${strategy === o.key ? ' active' : ''}`}
                            onClick={() => patchSuper({ drawdownStrategy: o.key })}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                      <p className="proj-note">{DRAWDOWN_CHOICES.find(o => o.key === strategy)!.hint}</p>
                      {strategy === 'percentOfBalance' && (
                        <Slider label="Share of super taken each year" min={2} max={10} step={0.5} value={sup.drawdownPct ?? 5} cls="teal-t" onChange={v => patchSuper({ drawdownPct: v })} />
                      )}
                    </fieldset>
                  </ReadOnlyFence>
                  <p className="proj-note mt1">Estimates, not advice. Super earns {(sup.investmentReturn * 100).toFixed(1)}% a year, less fees of {(sup.fundFeePercent * 100).toFixed(1)}% (set on Wealth &rarr; Super). Its earnings aren&rsquo;t taxed once you&rsquo;ve retired and turned {PRESERVATION_AGE}.</p>
                </>
              )}
              {current.key === 'fees' && (
                <SchoolFeeChart
                  labels={output.labels} childArrs={main.sfChildArr} childNames={feeChildNames}
                  familyArr={main.sfFamilyArr} sibArr={main.sfSibArr} totalArr={main.sfTotalArr} inflation={settings.sfInfl}
                  overlays={overlays(x => x.sfTotalArr)}
                />
              )}
            </div>
          </section>

          {compareRows.length > 0 && (
            <Panel title="Compare" dotColor="var(--blue)">
              <div className="compare" style={{ ['--compare-cols' as string]: compareFees ? 5 : 4 }}>
                <div className="compare-row compare-head" aria-hidden="true">
                  <span />
                  <span>Net worth at the end</span>
                  <span>Money gets tight</span>
                  <span>Retirement money</span>
                  {compareFees && <span>School fees</span>}
                  <span>Lowest cash</span>
                </div>
                {compareRows.map(row => {
                  const plan = compareRows[0].s
                  const diff = row.s.endNetWorth - plan.endNetWorth
                  const vsPlan = Math.abs(diff) < 500 ? 'same as plan' : `${diff > 0 ? '+' : '−'}${fmtK(Math.abs(diff))} vs plan`
                  return (
                    <div key={row.key} className="compare-row">
                      <span className="compare-name">
                        <i className={`chip-line${row.colour ? ' dashed' : ''}`} style={row.colour ? { borderColor: `var(--${row.colour})` } : undefined} />
                        <span>{row.name}{row.colour && <small>{row.changes === 0 ? 'No changes yet' : `${row.changes} change${row.changes === 1 ? '' : 's'}`}</small>}</span>
                      </span>
                      <span data-label="Net worth at the end">
                        <strong>{fmtK(row.s.endNetWorth)}</strong>
                        <small>{row.colour && row.s.endYear === plan.endYear ? vsPlan : `in ${row.s.endYear}`}</small>
                      </span>
                      <span data-label="Money gets tight"><strong>{row.s.tightYear ?? 'Not while working'}</strong></span>
                      <span data-label="Retirement money">
                        <strong className={row.s.runsOutAge !== null ? 'warn' : undefined}>{row.s.runsOutAge !== null ? `Runs short at ${row.s.runsOutAge}` : `Lasts past ${row.s.lastAge}`}</strong>
                      </span>
                      {compareFees && <span data-label="School fees"><strong>{row.s.schoolFees > 0 ? fmtK(row.s.schoolFees) : 'None'}</strong></span>}
                      <span data-label="Lowest cash"><strong>{fmtK(row.s.lowestCash.value)}</strong><small>in {row.s.lowestCash.year}</small></span>
                    </div>
                  )
                })}
              </div>
              <p className="proj-note mt1">
                Net worth leaves super out. &ldquo;Money gets tight&rdquo; is the first working year more goes out than comes in. Ages are {partnerEnabled ? possessive(person1Name) : 'yours'}. Change a scenario in What if?.
              </p>
            </Panel>
          )}

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
          <div className="whatif-body" key={editing ?? 'plan'}>
          <ReadOnlyFence canEdit={canEdit}>
          <div className="scenario-editing">
            <label className="scenario-editing-label" htmlFor="scenario-editing">Changes apply to</label>
            <div className="scenario-editing-row">
              <select id="scenario-editing" value={editing ?? ''} onChange={e => setEditing(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Your plan</option>
                {scenarios.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <button type="button" className="add-btn" onClick={newScenario}>+ New scenario</button>
            </div>
            {editingSc ? (
              <div className="scenario-banner" style={{ borderLeftColor: `var(--${scenarioColour(editingSc.colour)})` }}>
                <label className="scenario-name">
                  <span>Name</span>
                  <input defaultValue={editingSc.name} maxLength={40}
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== editingSc.name) saveScenario(editingSc.id, { name: v }) }} />
                </label>
                <p>Only this scenario changes; your plan stays as it is. Where you live, the custom fee table and extra costs by year are shared with your plan.</p>
                <div className="scenario-actions">
                  {ov && countChanges(ov) > 0 && <button type="button" className="add-btn" onClick={() => saveScenario(editingSc.id, { overrides: '{}' })}>Undo its changes</button>}
                  <button type="button" className="add-btn danger" onClick={() => deleteScenario(editingSc.id)}>Delete scenario</button>
                </div>
              </div>
            ) : (
              <p className="slider-hint">Changes here update your plan. To try something without changing it, start a new scenario.</p>
            )}
          </div>
          <div className="wi-group" data-group="basics">
            <Panel title="The basics" dotColor="var(--amber)">
              <Slider label={partnerEnabled ? 'Look ahead until the younger of you is' : 'Look ahead until you are'} min={70} max={105} step={1}
                value={ed.settings.horizonAge ?? DEFAULT_HORIZON_AGE} cls="amber-t" fmt={v => String(v)} onChange={v => editSettings({ horizonAge: v })} />
              <Slider label={`${possessive(person1Name)} pay rise each year`} min={0} max={15} step={0.5} value={ed.settings.person1Growth} cls="blue-t" onChange={v => editSettings({ person1Growth: v })} />
              {income.person2FTE > 0 && (
                <Slider label={`${possessive(person2Name)} pay rise each year`} min={0} max={15} step={0.5} value={ed.settings.person2Growth} cls="green-t" onChange={v => editSettings({ person2Growth: v })} />
              )}
              <Slider label="Safety net kept as cash" hint="Months of spending. Leftover money tops it up first, before anything is invested."
                min={0} max={24} step={1} value={ed.settings.cashBufferMonths ?? 0} cls="purple-t"
                fmt={v => v === 0 ? 'None' : `${v} month${v === 1 ? '' : 's'}`} onChange={v => editSettings({ cashBufferMonths: v })} />
              <Slider label="Leftover money you invest" hint={(ed.settings.cashBufferMonths ?? 0) > 0 ? 'Of what’s above the safety net. The rest stays as cash.' : 'The rest stays as cash.'}
                min={0} max={100} step={5} value={ed.settings.savingsRate} cls="purple-t" onChange={v => editSettings({ savingsRate: v })} />
              <Slider label="Leftover money you spend on fun" hint="Holidays, treats, upgrades. It’s spent, so it doesn’t add to what you own."
                min={0} max={100 - ed.settings.savingsRate} step={5} value={Math.min(ed.settings.funPct ?? 0, 100 - ed.settings.savingsRate)} cls="purple-t"
                onChange={v => editSettings({ funPct: v })} />
              <Slider label="Investment growth each year" hint="The total, dividends included, before tax." min={0} max={15} step={0.5} value={ed.settings.investReturn} cls="purple-t" onChange={v => editSettings({ investReturn: v })} />
              <MixControls
                growthPct={mixFrom(ed.settings).growthPct} glidePath={mixFrom(ed.settings).glidePath} glideTargetPct={mixFrom(ed.settings).glideTargetPct}
                showRange={rangeOn(ed.settings)} onChange={editSettings} />
              <details className="wi-more">
                <summary>More assumptions</summary>
                <Slider label={`Price rises, ${currentYear}–${String(currentYear + 2).slice(2)}`} min={0} max={10} step={0.5} value={ed.settings.expInflNear} cls="red-t" onChange={v => editSettings({ expInflNear: v })} />
                <Slider label="Price rises after that" min={0} max={8} step={0.5} value={ed.settings.expInfl} cls="red-t" onChange={v => editSettings({ expInfl: v })} />
                <Slider label="Childcare price rises" min={0} max={15} step={0.5} value={ed.settings.childcareInfl} cls="pink-t" onChange={v => editSettings({ childcareInfl: v })} />
                <Slider label="Property value growth" min={0} max={12} step={0.5} value={ed.settings.propGrowth} cls="amber-t" onChange={v => editSettings({ propGrowth: v })} />
                <Slider label="Savings account interest" hint="On cash above the home loan (cash in an offset saves loan interest instead). Taxed."
                  min={0} max={8} step={0.25} value={ed.settings.cashRate ?? DEFAULT_CASH_RATE} cls="blue-t" onChange={v => editSettings({ cashRate: v })} />
                <Slider label="Dividends paid out" hint="Part of the investment growth above, paid as dividends and reinvested. The tax on them is paid from cash."
                  min={0} max={8} step={0.25} value={ed.settings.dividendYield ?? DEFAULT_DIVIDEND_YIELD} cls="purple-t" onChange={v => editSettings({ dividendYield: v })} />
                <Slider label="Dividends with franking credits" hint="Australian shares usually pay franked dividends: company tax already paid comes off yours."
                  min={0} max={100} step={10} value={ed.settings.frankedPct ?? DEFAULT_FRANKED_PCT} cls="purple-t" onChange={v => editSettings({ frankedPct: v })} />
                {partnerEnabled && (
                  <Slider label={`Investments in ${possessive(person1Name)} name`} hint={`The rest in ${possessive(person2Name)}. Income in the lower earner’s name is taxed less.`}
                    min={0} max={100} step={10} value={ed.settings.person1InvestShare ?? DEFAULT_PERSON1_SHARE} cls="blue-t" onChange={v => editSettings({ person1InvestShare: v })} />
                )}
              </details>
            </Panel>
          </div>

          <div className="wi-group" data-group="work">
            <Panel title={`${possessive(person1Name)} work`} dotColor="var(--blue)">
              <Slider label="Stops work at age" hint={`${income.person1Age} now; pay stops in ${edMain.person1RetireYr ?? currentYear}.`} min={Math.max(40, income.person1Age)} max={80} step={1}
                value={ed.sup.person1RetirementAge} cls="blue-t" fmt={v => String(v)} onChange={v => editSuper({ person1RetirementAge: v })} />
              <WorkPhaseTimeline
                key={listKey(ed.person1Phases)}
                phases={ed.person1Phases} currentYear={currentYear}
                fte={income.person1FTE} showLeave={false}
                onUpdate={sc ? (id, field, value) => sc.p1.update(id, { [field]: value }) : updatePerson1Phase}
                onDelete={sc ? sc.p1.remove : deletePerson1Phase} onAdd={sc ? sc.p1.add : addPerson1Phase}
              />
            </Panel>
            <Panel
              title={`${possessive(person2Name)} work`}
              dotColor="var(--pink)"
              right={
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--t2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={ed.settings.parentalLeaveEnabled}
                    onChange={e => editSettings({ parentalLeaveEnabled: e.target.checked })}
                  />
                  Parental leave
                </label>
              }
            >
              {partnerEnabled && (
                <Slider label="Stops work at age" hint={`${income.person2Age} now; pay stops in ${edMain.person2RetireYr}.`} min={Math.max(40, income.person2Age)} max={80} step={1}
                  value={ed.sup.person2RetirementAge} cls="green-t" fmt={v => String(v)} onChange={v => editSuper({ person2RetirementAge: v })} />
              )}
              <WorkPhaseTimeline
                key={listKey(ed.person2Phases)}
                phases={ed.person2Phases} currentYear={currentYear}
                fte={income.person2FTE}
                showLeave={ed.settings.parentalLeaveEnabled}
                onUpdate={sc ? (id, field, value) => sc.p2.update(id, { [field]: value }) : updatePerson2Phase}
                onDelete={sc ? sc.p2.remove : deletePerson2Phase} onAdd={sc ? sc.p2.add : addPerson2Phase}
              />
            </Panel>
          </div>

          <div className="wi-group" data-group="family">
            <Panel title="Costs that change with age" dotColor="var(--pink)">
              <LifeStagesPanel
                on={ed.settings.lifeStagesOn ?? true} leaveHomeAge={ed.settings.childLeavesHomeAge ?? 18}
                regional={regional} kids={ed.children} currentYear={currentYear} key={listKey(ed.children)}
                onSettings={editSettings} onRegional={saveRegional}
                onAddChild={sc ? sc.kids.add : addChild} onUpdateChild={sc ? sc.kids.update : updateChild} onDeleteChild={sc ? sc.kids.remove : deleteChild}
              />
            </Panel>
          </div>

          <div className="wi-group" data-group="home">
            <Panel title="Housing" dotColor="var(--purple)">
              {/* Homeowner / Renter toggle (the plan only: today's spending already reflects it) */}
              {editing !== null && <p className="slider-hint">{ed.rent.enabled ? 'Renting' : 'Owning'}, as in your plan. A scenario can change the home purchase.</p>}
              <div style={{ display: editing === null ? 'flex' : 'none', gap: 5, marginBottom: 10 }}>
                {(['Homeowner', 'Renter'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => editRent({ enabled: mode === 'Renter' })}
                    style={{
                      flex: 1, padding: '5px 0', fontSize: '0.72rem', borderRadius: 5, cursor: 'pointer',
                      background: ed.rent.enabled === (mode === 'Renter') ? 'var(--blue)' : 'var(--surface2)',
                      color: ed.rent.enabled === (mode === 'Renter') ? 'var(--on-accent)' : 'var(--t2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {ed.rent.enabled && (
                <div className="da-grid" style={{ gap: 8 }}>
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Monthly rent</label>
                    <div className="input-prefix" style={{ width: 110 }}>
                      <span>$</span>
                      <input
                        type="number" min="0" step="50"
                        value={ed.rent.monthlyRent}
                        onChange={e => editRent({ monthlyRent: parseFloat(e.target.value) || 0 })}
                        style={{ textAlign: 'right' }}
                      />
                    </div>
                  </div>
                  <Slider
                    label="Annual rent increase" id="rentIncreaseRate" min={0} max={15} step={0.5}
                    value={ed.rent.annualIncreaseRate} cls="red-t"
                    onChange={v => editRent({ annualIncreaseRate: v })}
                  />
                  <p style={{ fontSize: '0.67rem', color: 'var(--t3)', margin: '2px 0 4px', lineHeight: 1.4 }}>
                    Rent is modelled separately — remove any rent expense from your budget to avoid double-counting.
                  </p>

                  {/* Purchase plan */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.73rem', color: 'var(--t2)', cursor: 'pointer', marginBottom: ed.rent.purchasePlanEnabled ? 10 : 0 }}>
                      <input
                        type="checkbox"
                        checked={ed.rent.purchasePlanEnabled}
                        onChange={e => editRent({ purchasePlanEnabled: e.target.checked })}
                      />
                      Model home purchase
                    </label>

                    {ed.rent.purchasePlanEnabled && (
                      <div className="da-grid" style={{ gap: 8 }}>
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Purchase year</label>
                          <input
                            className="da-input narrow" type="number"
                            value={ed.rent.targetPurchaseYear}
                            min={currentYear + 1} max={currentYear + 30}
                            onChange={e => editRent({ targetPurchaseYear: parseInt(e.target.value) })}
                          />
                        </div>
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Property value</label>
                          <div className="input-prefix" style={{ width: 110 }}>
                            <span>$</span>
                            <input
                              type="number" min="0" step="10000"
                              value={ed.rent.targetPropertyValue}
                              onChange={e => editRent({ targetPropertyValue: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: 'right' }}
                            />
                          </div>
                        </div>
                        <Slider
                          label="Deposit %" id="depositPct" min={5} max={40} step={5}
                          value={ed.rent.depositPct} cls="amber-t" fmt={v => v + '%'}
                          onChange={v => editRent({ depositPct: v })}
                        />
                        <Slider
                          label="Stamp duty & buying costs" id="stampDutyPct" min={0} max={8} step={0.5}
                          value={ed.rent.stampDutyPct} cls="amber-t" fmt={v => v + '%'}
                          onChange={v => editRent({ stampDutyPct: v })}
                        />
                        <p style={{ fontSize: '0.67rem', color: 'var(--t3)', margin: '2px 0', lineHeight: 1.4 }}>
                          Stamp duty depends on your state and the price; first-home buyers often pay less or none.
                          The amounts set aside below are used first, then other savings, then investments; anything still missing goes on the loan.
                        </p>
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Set aside from savings</label>
                          <div className="input-prefix" style={{ width: 110 }}>
                            <span>$</span>
                            <input
                              type="number" min="0" step="1000"
                              value={ed.rent.depositFromCash}
                              onChange={e => editRent({ depositFromCash: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: 'right' }}
                            />
                          </div>
                        </div>
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Set aside from investments</label>
                          <div className="input-prefix" style={{ width: 110 }}>
                            <span>$</span>
                            <input
                              type="number" min="0" step="1000"
                              value={ed.rent.depositFromInvestments}
                              onChange={e => editRent({ depositFromInvestments: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: 'right' }}
                            />
                          </div>
                        </div>
                        <Slider
                          label="New mortgage rate" id="newMortgageRate" min={3} max={12} step={0.25}
                          value={ed.rent.newMortgageRate} cls="blue-t"
                          onChange={v => editRent({ newMortgageRate: v })}
                        />
                        <div className="da-row">
                          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Mortgage term</label>
                          <select
                            className="freq-select"
                            value={ed.rent.newMortgageTermYrs}
                            onChange={e => editRent({ newMortgageTermYrs: parseInt(e.target.value) })}
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
                          <strong>Purchase {ed.rent.targetPurchaseYear}</strong><br/>
                          Property: {fmt(ed.rent.targetPropertyValue)}<br/>
                          {edMain.purchase ? (
                            <>
                              Upfront: {fmt(edMain.purchase.deposit)} deposit + {fmt(edMain.purchase.duty)} stamp duty &amp; costs<br/>
                              Paid from: {fmt(edMain.purchase.fromCash)} savings
                              {edMain.purchase.fromInvestments > 0 && <>, {fmt(edMain.purchase.fromInvestments)} investments ({fmt(edMain.purchase.cgt)} tax)</>}<br/>
                              Mortgage: {fmt(ed.rent.targetPropertyValue - edMain.purchase.deposit + edMain.purchase.borrowedExtra)} @ {ed.rent.newMortgageRate}%
                              {edMain.purchase.borrowedExtra > 0 && (
                                <span style={{ display: 'block', color: 'var(--amber)', marginTop: 4 }}>
                                  Savings and investments fall {fmt(edMain.purchase.borrowedExtra)} short then, so that’s added to the loan. A lender may not allow it.
                                </span>
                              )}
                            </>
                          ) : (
                            <>The purchase year is outside the projection.</>
                          )}
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
              <OneOffPanel key={listKey(ed.oneoffs)} oneoffs={ed.oneoffs} onAdd={sc ? sc.one.add : addOneoff}
                onUpdate={sc ? (id, field, value) => sc.one.update(id, { [field]: parseOneOff(field, value) }) : updateOneoff}
                onDelete={sc ? sc.one.remove : deleteOneoff} />
            </Panel>
            <Panel
              title="School fees"
              dotColor="var(--teal)"
              right={
                <label className="toggle-switch">
                  <input type="checkbox" checked={ed.settings.schoolFeesOn} onChange={e => editSettings({ schoolFeesOn: e.target.checked })} />
                  <span className="toggle-slider" />
                </label>
              }
            >
              {ed.settings.schoolFeesOn && (
                <div className="da-grid" style={{ gap: 8 }}>
                  {/* ── Education preset selector ──────────────────────── */}
                  {(() => {
                    const parts = ed.settings.sfPresetKey?.split('|')
                    const sfLoc  = parts?.[0] ?? 'vic'
                    const sfType = parts?.[1] ?? 'independent'
                    const isCustom = !ed.settings.sfPresetKey
                    const preset13 = ed.settings.sfPresetKey ? presetTotalFor(ed.settings.sfPresetKey) : null
                    return (
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--t3)', marginBottom: 5 }}>School type</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                          {(['government','catholic','independent'] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => editSettings({ sfPresetKey: `${sfLoc}|${t}` })}
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
                            onClick={() => editSettings({ sfPresetKey: null })}
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
                              onChange={e => editSettings({ sfPresetKey: `${e.target.value}|${sfType}` })}
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
                  {/* ── Each child's schools (school fees v2), or the old start years without children ── */}
                  {ed.children.length > 0 ? (
                    <div className="school-kids">
                      {sortChildren(ed.children).filter(k => currentYear - k.birthYear <= 17).map(k => {
                        const n = sortChildren(ed.children).indexOf(k) + 1
                        const set = (patch: { primarySchool?: SchoolChoice | null; secondarySchool?: SchoolChoice | null }) =>
                          (sc ? sc.kids.update(k.id, patch) : updateChild(k.id, patch))
                        const typeName = SCHOOL_LABEL[(ed.settings.sfPresetKey?.split('|')[1] ?? 'custom') as SchoolChoice] ?? 'Your own fees'
                        const pick = (label: string, value: string | null | undefined, key: 'primarySchool' | 'secondarySchool') => (
                          <label className="wp-field">
                            <span>{label}</span>
                            <select value={value ?? ''} onChange={e => set({ [key]: (e.target.value || null) as SchoolChoice | null })}>
                              <option value="">{`Same as above (${typeName})`}</option>
                              {(['government', 'catholic', 'independent', 'custom', 'none'] as const).map(c => <option key={c} value={c}>{SCHOOL_LABEL[c]}</option>)}
                            </select>
                          </label>
                        )
                        return (
                          <div key={k.id} className="school-kid">
                            <strong>{childLabel(k, n)}</strong> <small>born {k.birthYear}</small>
                            {pick('Kinder to Year 6', k.primarySchool, 'primarySchool')}
                            {pick('Years 7 to 12', k.secondarySchool, 'secondarySchool')}
                          </div>
                        )
                      })}
                      <p className="slider-hint">Children are added in What if? &rarr; Family. &ldquo;Same as above&rdquo; follows the school type chosen above.</p>
                    </div>
                  ) : (
                    <>
                  {/* ── Child settings ────────────────────────────────── */}
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Child 1 starts Kinder</label>
                    <input className="da-input narrow" type="number" value={ed.settings.sfC1Start} min={2024} max={2040} onChange={e => editSettings({ sfC1Start: parseInt(e.target.value) })} />
                  </div>
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Child 1 exits after</label>
                    <select className="freq-select" value={ed.settings.sfC1ExitIdx} onChange={e => editSettings({ sfC1ExitIdx: parseInt(e.target.value) })} style={{ flex: '0 0 auto', width: 110 }}>
                      {feeRows.map((r, i) => <option key={r.id} value={i}>{r.level}</option>)}
                    </select>
                  </div>
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Child 2 starts Kinder</label>
                    <input className="da-input narrow" type="number" value={ed.settings.sfC2Start} min={2024} max={2040} onChange={e => editSettings({ sfC2Start: parseInt(e.target.value) })} />
                  </div>
                  <div className="da-row">
                    <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Child 2 exits after</label>
                    <select className="freq-select" value={ed.settings.sfC2ExitIdx} onChange={e => editSettings({ sfC2ExitIdx: parseInt(e.target.value) })} style={{ flex: '0 0 auto', width: 110 }}>
                      {feeRows.map((r, i) => <option key={r.id} value={i}>{r.level}</option>)}
                    </select>
                  </div>
                    </>
                  )}
                  {/* ── The school's fee rules ── */}
                  <div className="school-rules">
                    <div className="explorer-sub">Your school&rsquo;s fee rules</div>
                    {([
                      ['sfSib2Pct', 'Off tuition for a 2nd child', '%'],
                      ['sfSib3Pct', 'Off tuition for a 3rd child', '%'],
                      ['sfSib4Pct', 'Off tuition for a 4th child or later', '%'],
                      ['sfFamilyFee', 'Family fee each year (building fund, levy)', '$'],
                      ['sfEntryFee', 'Entry fee per child at each new school', '$'],
                    ] as const).map(([key, label, unit]) => (
                      <div key={key} className="da-row">
                        <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>{label}</label>
                        <div className="input-prefix" style={{ width: 110 }}>
                          <span>{unit}</span>
                          <input type="number" min="0" max={unit === '%' ? 100 : undefined} step={unit === '%' ? 5 : 50}
                            value={ed.settings[key]} style={{ textAlign: 'right' }}
                            onChange={e => editSettings({ [key]: Math.max(0, parseFloat(e.target.value) || 0) })} />
                        </div>
                      </div>
                    ))}
                    <p className="slider-hint">Discounts count children at school in the same year, eldest first. Fees are in today&rsquo;s dollars and rise with fee inflation.</p>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <Slider label="Fee inflation / yr" id="sfInfl" min={0} max={10} step={0.5} value={ed.settings.sfInfl} cls="teal-t" onChange={v => editSettings({ sfInfl: v })} />
                  </div>
                  {/* Editable fee schedule — only in Custom mode */}
                  <details style={{ marginTop: 8, display: ed.settings.sfPresetKey && !ed.children.some(k => k.primarySchool === 'custom' || k.secondarySchool === 'custom') ? 'none' : undefined }}>
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
                        Used for &ldquo;Your own fees&rdquo;; sibling discounts follow your fee rules.
                      </p>
                    </div>
                  </details>
                </div>
              )}
            </Panel>
            <Panel
              title="Extra costs by year"
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

/**
 * How investments and super are held, the glide path, and whether the range
 * of outcomes is shown (@proviso/core/uncertainty).
 */
function MixControls({ growthPct, glidePath, glideTargetPct, showRange, onChange }: {
  growthPct: number; glidePath: boolean; glideTargetPct: number; showRange: boolean
  onChange: (patch: { growthPct?: number; glidePath?: boolean; glideTargetPct?: number; showRange?: boolean }) => void
}) {
  const safer = MIX_CHOICES.filter(m => m.growthPct < growthPct)
  return (
    <div className="mix-controls">
      <div className="wp-field">
        <span>How investments and super are held</span>
        <div className="seg" role="radiogroup" aria-label="Investment mix">
          {MIX_CHOICES.map(m => (
            <button key={m.growthPct} type="button" role="radio" aria-checked={growthPct === m.growthPct} className={growthPct === m.growthPct ? 'on' : ''}
              onClick={() => onChange({ growthPct: m.growthPct, ...(glideTargetPct >= m.growthPct ? { glideTargetPct: MIX_CHOICES.find(x => x.growthPct < m.growthPct)?.growthPct ?? 30 } : {}) })}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="slider-hint">More in shares and property grows faster on average but rises and falls more from year to year.</div>
      </div>
      {safer.length > 0 && (
        <div className="mix-glide">
          <label className="mix-check">
            <input type="checkbox" checked={glidePath} onChange={e => onChange({ glidePath: e.target.checked })} />
            Move to safer investments by retirement
          </label>
          {glidePath && (
            <div className="seg" role="radiogroup" aria-label="Mix by retirement">
              {safer.map(m => (
                <button key={m.growthPct} type="button" role="radio" aria-checked={glideTargetPct === m.growthPct} className={glideTargetPct === m.growthPct ? 'on' : ''}
                  onClick={() => onChange({ glideTargetPct: m.growthPct })}>{m.label}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <label className="mix-check">
        <input type="checkbox" checked={showRange} onChange={e => onChange({ showRange: e.target.checked })} />
        Show the range of outcomes
      </label>
      <div className="slider-hint">The shaded band is the middle 8 in 10 of 500 runs where returns rise and fall at random. Estimates, not advice.</div>
    </div>
  )
}
