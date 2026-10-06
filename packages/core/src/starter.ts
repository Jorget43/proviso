// Starting estimates for a new household. A few questions (where you live,
// who's in the household, home, cars) give a full first budget that people
// adjust, instead of typing every cost in from nothing.
//
// Every figure is a typical Australian amount in 2026 dollars (MODEL_BASE_YEAR)
// and is shown to the person before it's saved. Sources, per figure:
//   - Groceries: Canstar Blue grocery survey 2025–26, weekly spend by household size.
//   - Electricity: AER residential benchmarks (2020, kWh by household size),
//     priced at ~33c/kWh plus ~$420/yr supply, with a state price factor.
//   - Transport: AAA Transport Affordability Index Q4 2025 (fuel, rego, insurance,
//     servicing per car; capital vs regional; public transport).
//   - Childcare: Department of Education CCS data, Dec quarter 2025, average
//     hourly fee by state × a 10-hour session (regional ~10% lower).
//   - School costs: EDUCATION_PRESETS (Futurity Invest 2026).
//   - Rent suggestions: approximate 2025 medians, capital vs rest of state.
// Everything else (insurance, eating out, clothing, holidays) is a moderate
// round number, there to be changed.
//
// Re-check these once a year with the other FY figures (lib/watchdog.ts).

import { MODEL_BASE_YEAR } from './constants'
import { EDUCATION_PRESETS, type SchoolType } from './educationCosts'
import { computeMonthlyRepayment } from './mortgage'
import { helpDebtName } from './members'

export type StateKey = 'nsw' | 'vic' | 'qld' | 'sa' | 'wa' | 'tas' | 'act' | 'nt'

export const STATES: { key: StateKey; label: string; capital: string; split: boolean }[] = [
  { key: 'nsw', label: 'NSW', capital: 'Sydney',    split: true },
  { key: 'vic', label: 'VIC', capital: 'Melbourne', split: true },
  { key: 'qld', label: 'QLD', capital: 'Brisbane',  split: true },
  { key: 'wa',  label: 'WA',  capital: 'Perth',     split: true },
  { key: 'sa',  label: 'SA',  capital: 'Adelaide',  split: true },
  { key: 'tas', label: 'TAS', capital: 'Hobart',    split: false },
  { key: 'act', label: 'ACT', capital: 'Canberra',  split: false },
  { key: 'nt',  label: 'NT',  capital: 'Darwin',    split: false },
]

/** The location key EDUCATION_PRESETS uses: 'vic', 'vic_r', 'tas', … */
export function locationKey(state: StateKey, regional: boolean): string {
  const split = STATES.find(s => s.key === state)?.split ?? false
  return split && regional ? `${state}_r` : state
}

interface StateFigures {
  elecFactor:      number   // electricity price relative to NSW
  gasMonthly:      number   // typical gas bill where gas is common
  regoCtpYearly:   number   // registration + compulsory third party, per car
  childcareHourly: number   // average long-day-care fee
  rentWeekly:      { metro: number; regional: number }
}

const STATE: Record<StateKey, StateFigures> = {
  nsw: { elecFactor: 1.00, gasMonthly:  60, regoCtpYearly: 1100, childcareHourly: 14.60, rentWeekly: { metro: 780, regional: 560 } },
  vic: { elecFactor: 0.85, gasMonthly: 120, regoCtpYearly:  950, childcareHourly: 14.50, rentWeekly: { metro: 580, regional: 470 } },
  qld: { elecFactor: 0.95, gasMonthly:  25, regoCtpYearly:  900, childcareHourly: 14.05, rentWeekly: { metro: 680, regional: 590 } },
  wa:  { elecFactor: 0.95, gasMonthly:  50, regoCtpYearly:  950, childcareHourly: 14.65, rentWeekly: { metro: 680, regional: 560 } },
  sa:  { elecFactor: 1.15, gasMonthly:  60, regoCtpYearly:  850, childcareHourly: 13.95, rentWeekly: { metro: 620, regional: 430 } },
  tas: { elecFactor: 0.85, gasMonthly:  20, regoCtpYearly:  750, childcareHourly: 13.15, rentWeekly: { metro: 540, regional: 540 } },
  act: { elecFactor: 0.80, gasMonthly: 100, regoCtpYearly: 1150, childcareHourly: 15.20, rentWeekly: { metro: 690, regional: 690 } },
  nt:  { elecFactor: 0.85, gasMonthly:   0, regoCtpYearly:  700, childcareHourly: 12.90, rentWeekly: { metro: 590, regional: 590 } },
}

// ── Suggestions for the questions themselves (shown as "typical", never assumed) ──

export const TYPICAL = {
  salary:       100_000,  // median full-time earnings (ABS)
  helpBalance:   26_000,  // median HELP debt (ATO)
  mortgageRate:     6.2,  // average variable owner-occupier rate (RBA)
  mortgageYears:     25,
  cash:          25_000,  // median household savings (ABS)
}

/** Typical super balance for someone this age (ATO/ASFA balances by age band). */
export function typicalSuper(age: number): number {
  const bands: [number, number][] = [[25, 15_000], [30, 40_000], [35, 60_000], [40, 85_000], [45, 110_000], [50, 140_000], [55, 170_000], [60, 200_000]]
  let v = 5_000
  for (const [from, bal] of bands) if (age >= from) v = bal
  return v
}

export function typicalWeeklyRent(state: StateKey, regional: boolean): number {
  const r = STATE[state].rentWeekly
  return regional ? r.regional : r.metro
}

/** Average long-day-care fee per day here, before the Child Care Subsidy. */
export function typicalChildcareDay(state: StateKey, regional: boolean): number {
  return Math.round(STATE[state].childcareHourly * 10 * (regional ? 0.9 : 1))
}

// ── Answers ──────────────────────────────────────────────────────────────────

export interface StarterPerson {
  name:         string
  age:          number
  salary:       number   // gross full-time salary, excluding super
  days:         number   // days a week worked, 1–5 (0 = not working)
  hasHelp:      boolean
  helpBalance:  number
  superBalance: number
}

export interface StarterChild {
  age:           number   // whole years; 0 for a baby
  /** Days a week in childcare (children not yet at school). */
  childcareDays: number
}

export type HomeKind = 'own' | 'mortgage' | 'rent' | 'other'

export interface StarterAnswers {
  state:      StateKey
  regional:   boolean
  you:        StarterPerson
  partner:    StarterPerson | null
  children:   StarterChild[]
  /** Where school-age children go (or will go); null when there are none. */
  schoolType: SchoolType | null
  /** homeValue: what the home is worth, 0 when not given (owners only). */
  home:       { kind: HomeKind; weeklyRent: number; mortgageBalance: number; mortgageRate: number; mortgageYears: number; homeValue: number }
  cars:       number
  cash:       number
  investments: number
}

export const SCHOOL_START_AGE = 5   // Prep / Kindergarten (first year of school)
export const SCHOOL_END_AGE   = 17  // Year 12

/** Not at school yet (childcare-age). */
export const isPreschool = (c: StarterChild) => c.age < SCHOOL_START_AGE
export const isAtSchool  = (c: StarterChild) => c.age >= SCHOOL_START_AGE && c.age <= SCHOOL_END_AGE

// ── Living costs ─────────────────────────────────────────────────────────────

export type Freq = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface StarterLine {
  /** Stable within one estimate, so a review screen can track edits. */
  key:  string
  cat:  string
  name: string
  freq: Freq
  amt:  number
}

const round5 = (n: number) => Math.round(n / 5) * 5
const monthlyFromWeekly = (w: number) => round5(w * 52 / 12)

// Fee schedule levels (EDUCATION_PRESETS) start at the pre-school year, age 4.
const levelIndexFor = (age: number) => age - (SCHOOL_START_AGE - 1)

/** A first budget for the household described, every line ready to adjust. */
export function estimateLivingCosts(a: StarterAnswers): StarterLine[] {
  const s = STATE[a.state]
  const metro = !a.regional || !STATES.find(x => x.key === a.state)!.split
  const adults = a.partner ? 2 : 1
  const kids = a.children.length
  const people = adults + kids
  const owner = a.home.kind === 'own' || a.home.kind === 'mortgage'
  const cars = Math.max(0, Math.round(a.cars))
  const lines: StarterLine[] = []
  const add = (key: string, cat: string, name: string, freq: Freq, amt: number) => {
    if (amt > 0) lines.push({ key, cat, name, freq, amt: Math.round(amt) })
  }

  // Home
  if (a.home.kind === 'mortgage') {
    add('mortgage', 'Home', 'Mortgage', 'monthly',
      computeMonthlyRepayment(a.home.mortgageBalance, a.home.mortgageRate, a.home.mortgageYears * 12))
  }
  if (owner) {
    add('council', 'Home', 'Council rates', 'quarterly', metro ? 500 : 450)
    add('water', 'Utilities', 'Water rates', 'quarterly', 300)
    add('home-ins', 'Insurance', 'Home & contents insurance', 'yearly', metro ? 2200 : 2000)
    add('repairs', 'Home', 'Repairs & maintenance', 'monthly', 150)
  } else if (a.home.kind === 'rent') {
    add('contents-ins', 'Insurance', 'Contents insurance', 'yearly', 350)
    add('water', 'Utilities', 'Water usage', 'quarterly', 90)
  }

  // Food
  const groceriesWeekly = [0, 130, 185, 215, 255, 280][Math.min(people, 5)] + Math.max(0, people - 5) * 25
  add('groceries', 'Food', 'Groceries', 'monthly', monthlyFromWeekly(groceriesWeekly))
  add('eating-out', 'Eating Out', 'Eating out & takeaway', 'monthly', (adults === 1 ? 200 : 320) + kids * 40)

  // Utilities
  const kwh = [0, 3100, 5200, 6000, 7300, 8000][Math.min(people, 5)] + Math.max(0, people - 5) * 600
  add('electricity', 'Utilities', 'Electricity', 'monthly', round5((420 + kwh * 0.33) * s.elecFactor / 12))
  add('gas', 'Utilities', 'Gas', 'monthly', round5(s.gasMonthly * (people > 2 ? 1.25 : 1)))
  add('internet', 'Utilities', 'Internet', 'monthly', 85)
  const teens = a.children.filter(c => c.age >= 12).length
  add('phones', 'Utilities', 'Mobile phones', 'monthly', adults * 40 + teens * 30)

  // Transport
  if (cars > 0) {
    add('fuel', 'Transport', 'Fuel', 'monthly', cars * (metro ? 220 : 260))
    add('rego', 'Transport', `Car rego & CTP${cars > 1 ? ` (${cars} cars)` : ''}`, 'yearly', cars * s.regoCtpYearly)
    add('car-ins', 'Insurance', `Car insurance${cars > 1 ? ` (${cars} cars)` : ''}`, 'yearly', cars * 1300)
    add('servicing', 'Transport', 'Car servicing & tyres', 'yearly', cars * 900)
    if (metro && (a.state === 'nsw' || a.state === 'vic' || a.state === 'qld')) add('tolls', 'Transport', 'Tolls & parking', 'monthly', cars * 50)
  }
  const carless = Math.max(0, adults - cars)
  const ptPerAdult = metro ? (carless > 0 ? 160 : 0) : (carless > 0 ? 60 : 0)
  add('public-transport', 'Transport', 'Public transport', 'monthly', carless * ptPerAdult + (metro && cars > 0 ? 30 * adults : 0))

  // Health
  const healthMonthly = adults === 2 ? (kids ? 380 : 320) : (kids ? 280 : 160)
  add('health-ins', 'Insurance', 'Health insurance', 'monthly', healthMonthly)

  // Everyday
  add('streaming', 'Subscriptions', 'Streaming', 'monthly', 35)
  add('clothing', 'Shopping', 'Clothing & shoes', 'monthly', adults * 80 + kids * 50)
  add('personal', 'Shopping', 'Personal care & pharmacy', 'monthly', adults * 60 + kids * 20)
  add('fun', 'Fun', 'Entertainment & hobbies', 'monthly', adults * 150 + kids * 50)
  add('gifts', 'Fun', 'Gifts & celebrations', 'yearly', 600 + kids * 300)
  add('holidays', 'Travel', 'Holidays', 'yearly', adults * 2500 + kids * 1200)

  // Children: ordered eldest first so "Child 1" is the eldest
  const loc = locationKey(a.state, !metro)
  const preset = a.schoolType ? EDUCATION_PRESETS[`${loc}|${a.schoolType}`] : undefined
  const levels = preset ? Object.keys(preset.schedule) : []
  childOrder(a.children).forEach(({ child: c, n }) => {
    const who = `Child ${n} (${c.age === 0 ? 'baby' : `age ${c.age}`})`
    if (c.age < 3) add(`child-${n}-baby`, 'Children', `Nappies, formula & baby things: ${who}`, 'monthly', 200)
    else if (isPreschool(c)) add(`child-${n}-extras`, 'Children', `Kids' extras: ${who}`, 'monthly', 100)
    if (isAtSchool(c) && preset) {
      const level = levels[levelIndexFor(c.age)]
      const fee = level ? preset.schedule[level] : undefined
      if (fee) add(`child-${n}-school`, 'Children', `School costs: ${who}`, 'yearly', fee.tuition + fee.fixed)
    }
    // School cost presets already include uniforms, excursions and activities.
    else if (isAtSchool(c)) add(`child-${n}-activities`, 'Children', `Sport & activities: ${who}`, 'monthly', 80)
  })

  return lines
}

/** Children eldest first, numbered from 1. */
export function childOrder(children: StarterChild[]): { child: StarterChild; n: number }[] {
  return [...children].sort((x, y) => y.age - x.age).map((child, i) => ({ child, n: i + 1 }))
}

// ── The household to save ────────────────────────────────────────────────────

/** The asset the home is recorded as; netWorth.ts recognises it by name. */
export const HOME_EQUITY_NAME = 'Home equity'

function homeEquity(a: StarterAnswers): number {
  if (a.home.kind === 'own') return Math.max(0, a.home.homeValue)
  if (a.home.kind === 'mortgage' && a.home.homeValue > 0) return Math.max(0, a.home.homeValue - a.home.mortgageBalance)
  return 0
}

export interface StarterHousehold {
  household:  { person1Name: string; person2Name: string; partnerEnabled: boolean; onboardingDone: true }
  income:     { taxMode: true; person1FTE: number; person2FTE: number; person1HasHELP: boolean; person2HasHELP: boolean; person1Age: number; person2Age: number }
  workPhases: { person: 'p1' | 'p2'; year: number; days: number }[]
  super:      { person1Balance: number; person2Balance: number }
  childcare:  { enabled: boolean; costPerDay: number; daysPerWeek: number; numChildren: number }
  rent:       { enabled: boolean; monthlyRent: number }
  mortgage:   { balance: number; rate: number; payment: number; offsetBal: number; endDate: string } | null
  projection: {
    parentalLeaveEnabled: false
    // School fees are in the budget as lines (estimateLivingCosts), so the
    // projection's own school-fee model stays off until the Future screen
    // decides how the two meet. The children's start years are kept for it.
    schoolFeesOn: false
    sfC1Start: number; sfC2Start: number; sfPresetKey: string | null
  }
  expenses:   { cat: string; name: string; freq: Freq; amt: number }[]
  assets:     { name: string; amt: number; isOffset: boolean }[]
  debts:      { name: string; amt: number }[]
}

/**
 * Turns the answers, and the cost lines as the person left them on the review
 * screen, into the rows a new household starts with.
 */
export function buildStarterHousehold(a: StarterAnswers, lines: StarterLine[], now: Date): StarterHousehold {
  const year = now.getFullYear()
  const p = a.partner
  const mortgage = a.home.kind === 'mortgage' && a.home.mortgageBalance > 0
  const offset = mortgage && a.cash > 0
  const payment = computeMonthlyRepayment(a.home.mortgageBalance, a.home.mortgageRate, a.home.mortgageYears * 12)
  const preschoolers = a.children.filter(c => isPreschool(c) && c.childcareDays > 0)
  // School-fee start years for the two eldest children still at or before school.
  const schooling = childOrder(a.children).filter(({ child }) => child.age <= SCHOOL_END_AGE)
  const startYear = (age: number) => year - levelIndexFor(age)
  const loc = locationKey(a.state, a.regional)

  return {
    household: { person1Name: a.you.name.trim() || 'You', person2Name: p?.name.trim() || 'Partner', partnerEnabled: p !== null, onboardingDone: true },
    income: {
      taxMode: true,
      person1FTE: a.you.salary, person2FTE: p?.salary ?? 0,
      person1HasHELP: a.you.hasHelp, person2HasHELP: p?.hasHelp ?? false,
      person1Age: a.you.age, person2Age: p?.age ?? 30,
    },
    workPhases: [
      { person: 'p1', year, days: a.you.days },
      ...(p ? [{ person: 'p2' as const, year, days: p.days }] : []),
    ],
    super: { person1Balance: a.you.superBalance, person2Balance: p?.superBalance ?? 0 },
    childcare: {
      enabled: preschoolers.length > 0,
      costPerDay: typicalChildcareDay(a.state, a.regional),
      daysPerWeek: Math.max(0, ...preschoolers.map(c => c.childcareDays)) || 3,
      numChildren: preschoolers.length || 1,
    },
    rent: { enabled: a.home.kind === 'rent', monthlyRent: a.home.kind === 'rent' ? Math.round(a.home.weeklyRent * 52 / 12) : 0 },
    mortgage: mortgage ? {
      balance: a.home.mortgageBalance, rate: a.home.mortgageRate, payment,
      offsetBal: offset ? a.cash : 0,
      endDate: `${year + a.home.mortgageYears}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    } : null,
    projection: {
      parentalLeaveEnabled: false, schoolFeesOn: false,
      sfC1Start: schooling[0] ? startYear(schooling[0].child.age) : year + 6,
      sfC2Start: schooling[1] ? startYear(schooling[1].child.age) : year + 9,
      sfPresetKey: a.schoolType && a.children.length ? `${loc}|${a.schoolType}` : null,
    },
    expenses: [
      ...lines.map(({ cat, name, freq, amt }) => ({ cat, name, freq, amt })),
      // The managed childcare line: the budget fills in the after-subsidy cost.
      ...(preschoolers.length ? [{ cat: 'Children', name: 'Childcare', freq: 'monthly' as const, amt: 0 }] : []),
    ],
    assets: [
      { name: 'Cash / savings', amt: a.cash, isOffset: offset },
      { name: 'Shares & ETFs', amt: a.investments, isOffset: false },
      // The home counts once, as equity: its value less the loan (netWorth.ts).
      { name: HOME_EQUITY_NAME, amt: homeEquity(a), isOffset: false },
    ].filter(x => x.amt > 0),
    debts: [
      ...(a.you.hasHelp && a.you.helpBalance > 0 ? [{ name: helpDebtName(a.you.name.trim() || 'You'), amt: a.you.helpBalance }] : []),
      ...(p && p.hasHelp && p.helpBalance > 0 ? [{ name: helpDebtName(p.name.trim() || 'Partner'), amt: p.helpBalance }] : []),
    ],
  }
}

/** The year every figure here is priced in. */
export const STARTER_PRICE_YEAR = MODEL_BASE_YEAR
