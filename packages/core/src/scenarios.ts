// Scenarios: named sets of changes layered on the plan (plan item 2), e.g.
// "Private secondary", "Retire at 55", "Partner 3 days from 2028".
//
// A scenario stores only what differs from the plan, as one JSON field
// (`scenario.overrides`). So it follows the plan everywhere else: change
// today's spending and every scenario moves with it. The sync rule for a
// single JSON field: the latest edit wins for the whole scenario's changes,
// not per setting. That's fine for a named bundle someone edits on one
// device at a time.
//
// What a scenario can change:
//   settings       projection settings (pay rises, savings rule, school fees…)
//   super          retirement ages, extra contributions, the income goal, drawdown
//   rent           the home-purchase plan and rent (not renting vs owning, which
//                  the budget's spending already reflects)
//   person1Phases  a person's work pattern, as a whole list
//   person2Phases
//   oneoffs        big one-off costs, as a whole list
//   children       children and planned babies, as a whole list
//
// Overrides from a newer app version may carry keys this one doesn't know.
// They're kept: edits go through patchOverrides on the raw object, and only
// validOverrides (what the engine reads) leaves them out.

import { z } from 'zod'
import { projectionSettingsSchema, rentSettingsSchema, superSettingsSchema } from './schemas'
import { buildProjectionInputs, type ProjectionBaseline, type ProjectionLive, type ProjectionSettingsLike, type RentSettingsLike, type SuperSettingsLike } from './future'
import { runProjections, type OneOff, type ProjectionOutput, type WorkPhase } from './projections'
import { presetScheduleFor } from './educationCosts'
import type { FeeSchedule } from './schoolFees'
import type { ChildLike } from './people'

/** Colours a scenario can take: palette names, so both themes have them. */
export const SCENARIO_COLOURS = ['blue', 'amber', 'pink', 'teal', 'purple'] as const
export type ScenarioColour = (typeof SCENARIO_COLOURS)[number]

const isColour = (c: unknown): c is ScenarioColour => SCENARIO_COLOURS.includes(c as ScenarioColour)

/** A stored colour, or a fallback by position when it's missing or unknown. */
export function scenarioColour(stored: string | null | undefined, index = 0): ScenarioColour {
  return isColour(stored) ? stored : SCENARIO_COLOURS[index % SCENARIO_COLOURS.length]
}

/** The first colour not yet taken (they repeat once all are used). */
export function nextScenarioColour(taken: (string | null | undefined)[]): ScenarioColour {
  return SCENARIO_COLOURS.find(c => !taken.includes(c)) ?? SCENARIO_COLOURS[taken.length % SCENARIO_COLOURS.length]
}

export type ScenarioSuper = Pick<SuperSettingsLike,
  'person1RetirementAge' | 'person2RetirementAge' | 'person1AdditionalContribs' | 'person2AdditionalContribs' |
  'desiredRetirementIncome' | 'drawdownStrategy' | 'drawdownPct'>

/** Renting vs owning isn't a scenario choice: today's spending already reflects it. */
export type ScenarioRent = Omit<RentSettingsLike, 'enabled'>

export interface ScenarioChild { name: string | null; birthYear: number; birthMonth: number | null }

export interface ScenarioOverrides {
  settings?:      Partial<ProjectionSettingsLike>
  super?:         Partial<ScenarioSuper>
  rent?:          Partial<ScenarioRent>
  person1Phases?: WorkPhase[]
  person2Phases?: WorkPhase[]
  oneoffs?:       OneOff[]
  children?:      ScenarioChild[]
}

export type OverrideSection = keyof ScenarioOverrides

// ── Reading and writing the JSON ─────────────────────────────────────────────

type Raw = Record<string, unknown>

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The stored JSON as an object; anything unreadable is no changes. */
export function readOverrides(json: string | null | undefined): Raw {
  if (!json) return {}
  try {
    const v: unknown = JSON.parse(json)
    return isObject(v) ? v : {}
  } catch {
    return {}
  }
}

const SUPER_KEYS = ['person1RetirementAge', 'person2RetirementAge', 'person1AdditionalContribs', 'person2AdditionalContribs',
  'desiredRetirementIncome', 'drawdownStrategy', 'drawdownPct'] as const

const settingsShape = projectionSettingsSchema.shape
const rentShape     = (({ enabled: _e, ...rest }) => rest)(rentSettingsSchema.shape)
const superShape    = Object.fromEntries(SUPER_KEYS.map(k => [k, superSettingsSchema.shape[k]]))

/** The fields of `raw` that pass their own check; one bad field doesn't cost the rest. */
function pickValid(shape: Record<string, z.ZodType>, raw: unknown): Raw | undefined {
  if (!isObject(raw)) return undefined
  const out: Raw = {}
  for (const [k, schema] of Object.entries(shape)) {
    if (!(k in raw)) continue
    const r = schema.safeParse(raw[k])
    if (r.success && r.data !== undefined) out[k] = r.data
  }
  return Object.keys(out).length ? out : undefined
}

const phase   = z.object({ year: z.number().int().min(1900).max(2200), days: z.number().int().min(0).max(5) })
const oneOff  = z.object({ name: z.string(), amt: z.number().finite(), year: z.number().int().min(1900).max(2200) })
const childOf = z.object({ name: z.string().nullable().catch(null), birthYear: z.number().int().min(1900).max(2200), birthMonth: z.number().int().min(1).max(12).nullable().catch(null) })

function validList<T>(schema: z.ZodType<T>, raw: unknown): T[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap(x => { const r = schema.safeParse(x); return r.success ? [r.data] : [] })
}

/** What the engine uses: the known, valid parts of the stored overrides. */
export function validOverrides(raw: Raw): ScenarioOverrides {
  const o: ScenarioOverrides = {
    settings:      pickValid(settingsShape, raw.settings) as Partial<ProjectionSettingsLike> | undefined,
    super:         pickValid(superShape, raw.super) as Partial<ScenarioSuper> | undefined,
    rent:          pickValid(rentShape, raw.rent) as Partial<ScenarioRent> | undefined,
    person1Phases: validList(phase, raw.person1Phases),
    person2Phases: validList(phase, raw.person2Phases),
    oneoffs:       validList(oneOff, raw.oneoffs),
    children:      validList(childOf, raw.children),
  }
  for (const k of Object.keys(o) as OverrideSection[]) if (o[k] === undefined) delete o[k]
  return o
}

/**
 * Applies an edit to the stored overrides. Settings-like sections merge field
 * by field; lists replace. `null` for a section removes it (back to the plan).
 * Keys this version doesn't know are left as they were.
 */
export function patchOverrides(raw: Raw, patch: { [K in OverrideSection]?: ScenarioOverrides[K] | null }): Raw {
  const next: Raw = { ...raw }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if (v === null) { delete next[k]; continue }
    next[k] = Array.isArray(v) ? v : { ...(isObject(next[k]) ? next[k] : {}), ...v }
  }
  return next
}

export const writeOverrides = (raw: Raw): string => JSON.stringify(raw)

/** How many things a scenario changes (each setting counts once; each list counts once). */
export function countChanges(o: ScenarioOverrides): number {
  return Object.keys(o.settings ?? {}).length + Object.keys(o.super ?? {}).length + Object.keys(o.rent ?? {}).length
    + (['person1Phases', 'person2Phases', 'oneoffs', 'children'] as const).filter(k => o[k] !== undefined).length
}

// ── Running them ─────────────────────────────────────────────────────────────

/**
 * The plan with a scenario's changes on top. `ownSchedule` is the household's
 * own school-fee table, used when a scenario switches to "Custom" fees.
 */
export function applyScenario(live: ProjectionLive, o: ScenarioOverrides, ownSchedule?: FeeSchedule): ProjectionLive {
  const settings = { ...live.settings, ...o.settings }
  const presetChanged = o.settings !== undefined && 'sfPresetKey' in o.settings
  const sfSchedule = presetChanged
    ? (settings.sfPresetKey && presetScheduleFor(settings.sfPresetKey)) || ownSchedule || live.sfSchedule
    : live.sfSchedule
  const children: ChildLike[] | undefined = o.children
    ? o.children.map((c, i) => ({ id: `scenario-${i}`, ...c }))
    : live.children
  return {
    ...live,
    settings, sfSchedule, children,
    rent:          { ...live.rent, ...o.rent },
    person1Phases: o.person1Phases ?? live.person1Phases,
    person2Phases: o.person2Phases ?? live.person2Phases,
    oneoffs:       o.oneoffs ?? live.oneoffs,
    life:          live.life && { ...live.life, super: { ...live.life.super, ...o.super } },
  }
}

export interface ScenarioLike {
  id:        string | number
  name:      string
  colour:    string | null
  enabled:   boolean
  overrides: string
}

export interface ScenarioRun<S extends ScenarioLike = ScenarioLike> {
  scenario: S
  colour:   ScenarioColour
  live:     ProjectionLive
  output:   ProjectionOutput
}

/** Each scenario run through the same engine as the plan. */
export function runScenarios<S extends ScenarioLike>(baseline: ProjectionBaseline, live: ProjectionLive, scenarios: S[], ownSchedule?: FeeSchedule): ScenarioRun<S>[] {
  return scenarios.map((scenario, i) => {
    const l = applyScenario(live, validOverrides(readOverrides(scenario.overrides)), ownSchedule)
    return { scenario, colour: scenarioColour(scenario.colour, i), live: l, output: runProjections(buildProjectionInputs(baseline, l)) }
  })
}

// ── Comparing them ───────────────────────────────────────────────────────────

export interface ScenarioSummary {
  /** The last year projected, and net worth then (super not counted). */
  endYear:        number
  endNetWorth:    number
  /** The first year, while someone still works, that more goes out than comes in. */
  tightYear:      number | null
  /** Person 1's age when money runs short in retirement, or null if it lasts. */
  runsOutAge:     number | null
  /** Person 1's age in the last year projected. */
  lastAge:        number
  /** School fees over the whole projection (0 when they're off). */
  schoolFees:     number
  /** Cash at the end of its lowest year. */
  lowestCash:     { year: number; value: number }
}

/**
 * The Compare card's figures for one run. The "money gets tight" year only
 * counts working years: once everyone has retired, living off savings is
 * the plan, and running short then is runsOutAge.
 */
export function summariseRun(output: ProjectionOutput, live: Pick<ProjectionLive, 'currentYear' | 'settings' | 'life'>): ScenarioSummary {
  const run = output.withFees ?? output.base
  const years = output.labels.map(Number)
  const n = run.nwArr.length
  const retiredIdx = run.retiredArr.indexOf(true)
  const workingEnd = retiredIdx >= 0 ? retiredIdx : n
  const tightIdx = run.deficitArr.slice(0, workingEnd).findIndex(v => v < 0)
  const age = live.life?.person1Age ?? null
  let low = 0
  run.cashArr.forEach((v, i) => { if (v < run.cashArr[low]) low = i })
  return {
    endYear:     years[n - 1] ?? live.currentYear,
    endNetWorth: run.nwArr[n - 1] ?? 0,
    tightYear:   tightIdx >= 0 ? years[tightIdx] : null,
    runsOutAge:  run.shortfallYr && age !== null ? age + (run.shortfallYr - live.currentYear) : null,
    lastAge:     age !== null ? age + n : 0,
    schoolFees:  live.settings.schoolFeesOn ? run.sfTotalArr.reduce((t, v) => t + v, 0) : 0,
    lowestCash:  { year: years[low] ?? live.currentYear, value: run.cashArr[low] ?? 0 },
  }
}
