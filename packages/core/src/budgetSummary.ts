// The household's current month, as the Budget tab shows it: after-tax income,
// amortised expenses (regular lines, annual bills spread over 12 months, rent)
// and what's left over. Shared by the Budget tab and the Home overview so the
// two can never disagree.
import { toMonthly } from './formatting'
import { calcAfterTax } from './tax'
import { netPay, NO_PACKAGE, type PackageYear } from './packaging'
import { businessYear } from './businessIncome'
import { grossFromNet } from './investmentIncome'
import { computeChildcare } from './childcare'
import { CATS } from './constants'

export const CHILDCARE_CAT  = 'Children'
export const CHILDCARE_NAME = 'Childcare'

export interface BudgetExpense { id: number | string; cat: string; name: string; freq: string; amt: number }
export interface BudgetAnnualExpense { id: number | string; cat: string; name: string; amt: number; month: number }

export interface BudgetIncome {
  taxMode:           boolean
  person1FTE:        number
  person2FTE:        number
  person1HasHELP:    boolean
  person2HasHELP:    boolean
  person1MonthlyNet: number
  person2MonthlyNet: number
}

export interface BudgetChildcare {
  enabled:     boolean
  costPerDay:  number
  daysPerWeek: number
  numChildren: number
}

// Generic over the expense row, so callers get their own row type back in
// shownExpenses (Prisma rows on the NAS, Drizzle rows in the app).
export interface BudgetInputs<E extends BudgetExpense = BudgetExpense> {
  expenses:       E[]
  annualExpenses: BudgetAnnualExpense[]
  income:         BudgetIncome
  childcare:      BudgetChildcare
  rentMonthly:    number | null   // null when not renting
  person1Days:    number
  person2Days:    number
  partnerEnabled: boolean
  /** This year's salary packaging per person (packaging.ts packagingNow); none if left out. */
  packaging?:     { p1: PackageYear; p2: PackageYear }
  /** This year's business profit per person (businessIncome.ts businessProfit), before tax; none if left out. */
  business?:      { p1: number; p2: number }
}

export interface BudgetSummary<E extends BudgetExpense = BudgetExpense> {
  person1Gross:    number
  person2Gross:    number
  familyIncome:    number
  person1Net:      number         // monthly
  person2Net:      number         // monthly
  monthlyIncome:   number
  /** Extra take-home pay a month from salary packaging (in monthlyIncome already). */
  packagingMonthly: number
  /** Business income a month after its tax and HELP (in monthlyIncome already). */
  businessMonthly: number
  childcareNet:    number | null  // CCS-adjusted monthly cost, null when off
  shownExpenses:   E[]
  monthlyExpenses: number
  catMonthly:      Record<string, number>
  delta:           number
  savingsRate:     number         // % of income
}

export function isManagedChildcare(e: { cat: string; name: string }): boolean {
  return e.cat === CHILDCARE_CAT && e.name === CHILDCARE_NAME
}

export function computeBudgetSummary<E extends BudgetExpense>(i: BudgetInputs<E>): BudgetSummary<E> {
  // Each person's gross is pro-rated by days worked this year (same rule as
  // the Projections engine); Person 2 counts only when the partner is enabled.
  const person1Gross = i.income.person1FTE * (i.person1Days / 5)
  const person2Gross = i.partnerEnabled ? i.income.person2FTE * (i.person2Days / 5) : 0
  const biz1 = Math.max(0, i.business?.p1 ?? 0)
  const biz2 = i.partnerEnabled ? Math.max(0, i.business?.p2 ?? 0) : 0
  // Combined gross family income (business profit included) drives the CCS taper.
  const familyIncome = person1Gross + person2Gross + biz1 + biz2

  // Packaging only applies to salaries (tax mode); take-home figures are as entered.
  const pk1 = i.income.taxMode && i.packaging ? i.packaging.p1 : NO_PACKAGE
  const pk2 = i.income.taxMode && i.packaging && i.partnerEnabled ? i.packaging.p2 : NO_PACKAGE
  const person1Net = i.income.taxMode
    ? netPay(person1Gross, 0, i.income.person1HasHELP, pk1) / 12
    : i.income.person1MonthlyNet
  const person2Net = !i.partnerEnabled ? 0
    : i.income.taxMode ? netPay(person2Gross, 0, i.income.person2HasHELP, pk2) / 12
    : i.income.person2MonthlyNet
  // Business profit is taxed on top of pay (take-home pay households: on top
  // of the gross that leaves it); HELP counts it.
  const bizNet = (profit: number, gross: number, net: number, pk: PackageYear, hasHELP: boolean) => {
    const base = i.income.taxMode ? Math.max(0, gross - pk.pretax) : grossFromNet(net * 12)
    const helpIncome = i.income.taxMode ? gross + pk.reportable : base
    return businessYear(profit, base, helpIncome, hasHELP ? Infinity : 0).cash
  }
  const businessMonthly = (bizNet(biz1, person1Gross, i.income.person1MonthlyNet, pk1, i.income.person1HasHELP)
    + bizNet(biz2, person2Gross, i.income.person2MonthlyNet, pk2, i.income.person2HasHELP)) / 12
  const monthlyIncome = person1Net + person2Net + businessMonthly
  const packagingMonthly = i.income.taxMode
    ? (netPay(person1Gross, 0, i.income.person1HasHELP, pk1) - calcAfterTax(person1Gross, i.income.person1HasHELP)
      + (i.partnerEnabled ? netPay(person2Gross, 0, i.income.person2HasHELP, pk2) - calcAfterTax(person2Gross, i.income.person2HasHELP) : 0)) / 12
    : 0

  // The managed "Childcare" line always shows the current CCS-adjusted cost
  // (or disappears when childcare is off).
  const childcareNet = i.childcare.enabled
    ? Math.round(computeChildcare({
        costPerDay:  i.childcare.costPerDay,
        daysPerWeek: i.childcare.daysPerWeek,
        numChildren: i.childcare.numChildren,
        familyIncome,
      }).netMonthly)
    : null
  const shownExpenses = i.expenses.flatMap(e => (isManagedChildcare(e)
    ? (childcareNet === null ? [] : [{ ...e, amt: childcareNet }])
    : [e]))

  const catMonthly: Record<string, number> = {}
  CATS.forEach(c => { catMonthly[c] = 0 })
  shownExpenses.forEach(e => { catMonthly[e.cat] = (catMonthly[e.cat] ?? 0) + toMonthly(e.amt, e.freq) })
  i.annualExpenses.forEach(a => { catMonthly[a.cat] = (catMonthly[a.cat] ?? 0) + a.amt / 12 })
  if (i.rentMonthly !== null) catMonthly['Home'] = (catMonthly['Home'] ?? 0) + i.rentMonthly

  const monthlyExpenses = Object.values(catMonthly).reduce((s, v) => s + v, 0)
  const delta = monthlyIncome - monthlyExpenses
  const savingsRate = monthlyIncome > 0 ? delta / monthlyIncome * 100 : 0

  return {
    person1Gross, person2Gross, familyIncome, person1Net, person2Net, monthlyIncome, packagingMonthly, businessMonthly,
    childcareNet, shownExpenses, monthlyExpenses, catMonthly, delta, savingsRate,
  }
}

/** Annual bills falling due within the next `withinMonths` months, soonest first. */
export function upcomingAnnualExpenses<T extends { month: number }>(items: T[], now: Date, withinMonths = 3): (T & { monthsAway: number })[] {
  const thisMonth = now.getMonth() + 1
  return items
    .map(a => ({ ...a, monthsAway: (a.month - thisMonth + 12) % 12 }))
    .filter(a => a.monthsAway < withinMonths)
    .sort((a, b) => a.monthsAway - b.monthsAway)
}
