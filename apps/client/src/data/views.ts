// What each screen shows, as pure functions of the household data. Figures
// come from @proviso/core, so they match the NAS web app exactly; these only
// arrange them for the app's screens.

import { computeHomeOverview, type HomeOverview } from '@proviso/core/overview'
import { computeBudgetSummary, isManagedChildcare } from '@proviso/core/budgetSummary'
import { workDaysForYear } from '@proviso/core/projections'
import { situationFrom, situationLabels } from '@proviso/core/situation'
import { toMonthly } from '@proviso/core/formatting'
import { CATS, CAT_COLORS } from '@proviso/core/constants'
import type { HouseholdRow } from '@proviso/core/schema'
import type { HouseholdData } from './household'

type Expense = HouseholdRow<'expense'>

const rentMonthly = (h: HouseholdData) => (h.rent.enabled ? h.rent.monthlyRent : null)
const phases = (h: HouseholdData) => ({
  p1: h.workPhases.filter(w => w.person === 'p1'),
  p2: h.workPhases.filter(w => w.person === 'p2'),
})

export interface HomeView extends HomeOverview<Expense> {
  person1Name: string
  person2Name: string
  situation:   string[]
}

export function homeView(h: HouseholdData, now: Date): HomeView {
  const o = computeHomeOverview({
    now,
    expenses: h.expenses, annualExpenses: h.annualExpenses,
    income: h.income, childcare: h.childcare,
    rentMonthly: rentMonthly(h),
    workPhases: phases(h),
    partnerEnabled: h.settings.partnerEnabled,
    assets: h.assets, debts: h.debts, mortgage: h.mortgage,
    superBalances: { p1: h.superSettings.person1Balance, p2: h.superSettings.person2Balance },
    snapshots: h.netWorthSnapshots,
  })
  const situation = situationFrom({ partnerEnabled: h.settings.partnerEnabled, childcare: h.childcare, rent: h.rent, projection: h.projection })
  return { ...o, person1Name: h.settings.person1Name, person2Name: h.settings.person2Name, situation: situationLabels(situation, h.settings.person2Name) }
}

export type SpendingLineKind = 'regular' | 'annual' | 'rent' | 'childcare'

export interface SpendingLine {
  id:      string
  kind:    SpendingLineKind
  name:    string
  /** The amount as entered, and how often ('yearly' with a month for annual bills). */
  amt:     number
  freq:    string
  month?:  number
  monthly: number
  /** False for lines the app manages (rent, childcare): edited in their own settings. */
  editable: boolean
}

export interface SpendingCategory {
  cat:     string
  color:   string
  monthly: number
  share:   number   // of total monthly spending, 0–1
  lines:   SpendingLine[]
}

export interface SpendingView {
  monthlyIncome:   number
  monthlyExpenses: number
  left:            number
  person1Net:      number
  person2Net:      number
  categories:      SpendingCategory[]   // biggest first; empty categories left out
}

export function spendingView(h: HouseholdData, now: Date): SpendingView {
  const year = now.getFullYear()
  const p = phases(h)
  const b = computeBudgetSummary({
    expenses: h.expenses, annualExpenses: h.annualExpenses, income: h.income, childcare: h.childcare,
    rentMonthly: rentMonthly(h),
    person1Days: workDaysForYear(p.p1, year), person2Days: workDaysForYear(p.p2, year),
    partnerEnabled: h.settings.partnerEnabled,
  })

  const lines = new Map<string, SpendingLine[]>()
  const add = (cat: string, line: SpendingLine) => lines.set(cat, [...(lines.get(cat) ?? []), line])
  for (const e of b.shownExpenses) {
    const managed = isManagedChildcare(e)
    add(e.cat, { id: e.id, kind: managed ? 'childcare' : 'regular', name: e.name, amt: e.amt, freq: e.freq,
      monthly: toMonthly(e.amt, e.freq), editable: !managed })
  }
  for (const a of h.annualExpenses) {
    add(a.cat, { id: a.id, kind: 'annual', name: a.name, amt: a.amt, freq: 'yearly', month: a.month, monthly: a.amt / 12, editable: true })
  }
  const rent = rentMonthly(h)
  if (rent !== null) add('Home', { id: 'rent', kind: 'rent', name: 'Rent', amt: rent, freq: 'monthly', monthly: rent, editable: false })

  const total = b.monthlyExpenses
  const colorOf = (cat: string) => {
    const i = (CATS as readonly string[]).indexOf(cat)
    return CAT_COLORS[(i >= 0 ? i : CATS.length) % CAT_COLORS.length]
  }
  const categories = [...lines.entries()]
    .map(([cat, ls]) => ({
      cat, color: colorOf(cat),
      monthly: b.catMonthly[cat] ?? ls.reduce((s, l) => s + l.monthly, 0),
      share: total > 0 ? (b.catMonthly[cat] ?? 0) / total : 0,
      lines: ls.sort((x, y) => y.monthly - x.monthly),
    }))
    .sort((x, y) => y.monthly - x.monthly)

  return {
    monthlyIncome: b.monthlyIncome, monthlyExpenses: b.monthlyExpenses, left: b.delta,
    person1Net: b.person1Net, person2Net: b.person2Net, categories,
  }
}
