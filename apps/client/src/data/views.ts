// What each screen shows, as pure functions of the household data. Figures
// come from @proviso/core, so they match the NAS web app exactly; these only
// arrange them for the app's screens.

import { computeHomeOverview, type HomeOverview } from '@proviso/core/overview'
import { computeBudgetSummary, isManagedChildcare } from '@proviso/core/budgetSummary'
import { workDaysForYear } from '@proviso/core/projections'
import { situationFrom, situationLabels } from '@proviso/core/situation'
import { toMonthly } from '@proviso/core/formatting'
import { netPositionOf, computeCashOnHand, isHomeEquity } from '@proviso/core/netWorth'
import { findHelpDebt } from '@proviso/core/members'
import { calcHELPRepayment } from '@proviso/core/tax'
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

// ── Wealth ───────────────────────────────────────────────────────────────────

export interface WealthItem {
  id:   string
  name: string
  amt:  number
  /** Marked as cash: counts towards the safety net and offsets the home loan. */
  cash: boolean
  home: boolean
}

export interface WealthView {
  netWorth:       number
  netWorthChange: HomeView['netWorthChange']
  totalOwned:     number
  /** Debts counted against net worth (a "mortgage" debt is netted in the home's equity). */
  totalOwed:      number
  owned:          WealthItem[]   // biggest first
  owed:           WealthItem[]
  cash:           number
  coverMonths:    number | null
  /** The home loan, when there is one (not renting, balance owing). */
  loan:           { balance: number; rate: number; payment: number; offset: number; endYear: number | null; monthlyInterest: number } | null
  /** Owners with a loan but no "Home equity" asset: their home isn't counted yet. */
  homeMissing:    boolean
  help:           { person: 'p1' | 'p2'; name: string; balance: number; yearlyRepayment: number }[]
  super:          { person: 'p1' | 'p2'; name: string; balance: number; retirementAge: number }[]
}

export function wealthView(h: HouseholdData, now: Date): WealthView {
  const home = homeView(h, now)
  const position = netPositionOf(h.debts, h.assets)
  const year = now.getFullYear()
  const p = phases(h)
  const people = [
    { person: 'p1' as const, name: h.settings.person1Name, n: 1 as const, days: workDaysForYear(p.p1, year) },
    ...(h.settings.partnerEnabled ? [{ person: 'p2' as const, name: h.settings.person2Name, n: 2 as const, days: workDaysForYear(p.p2, year) }] : []),
  ]
  const item = (x: { id: string; name: string; amt: number; isOffset?: boolean }): WealthItem =>
    ({ id: x.id, name: x.name, amt: x.amt, cash: x.isOffset ?? false, home: isHomeEquity(x) })
  const byAmt = (a: WealthItem, b: WealthItem) => b.amt - a.amt

  const m = h.mortgage
  const loan = m && m.balance > 0 && !h.rent.enabled ? (() => {
    const offset = h.assets.some(a => a.isOffset) ? computeCashOnHand(h.assets) : m.offsetBal
    return {
      balance: m.balance, rate: m.rate, payment: m.payment, offset,
      endYear: home.mortgageEndYear,
      monthlyInterest: Math.max(0, m.balance - offset) * (m.rate / 100) / 12,
    }
  })() : null

  return {
    netWorth: home.netWorth, netWorthChange: home.netWorthChange,
    totalOwned: position.totalAssets, totalOwed: position.debtsOwed,
    owned: h.assets.map(item).sort(byAmt),
    owed: h.debts.map(item).sort(byAmt),
    cash: home.cash, coverMonths: home.coverMonths,
    loan,
    homeMissing: loan !== null && !h.assets.some(isHomeEquity),
    help: people.flatMap(x => {
      const debt = findHelpDebt(h.debts, x.name)
      if (!debt && !h.income[`person${x.n}HasHELP`]) return []
      const gross = h.income.taxMode ? h.income[`person${x.n}FTE`] * x.days / 5 : 0
      return [{ person: x.person, name: x.name, balance: debt?.amt ?? 0, yearlyRepayment: calcHELPRepayment(gross) }]
    }),
    super: people.map(x => ({
      person: x.person, name: x.name,
      balance: h.superSettings[`person${x.n}Balance`], retirementAge: h.superSettings[`person${x.n}RetirementAge`],
    })),
  }
}
