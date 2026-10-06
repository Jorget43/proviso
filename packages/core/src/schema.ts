// The local-first data model (docs/architecture.md, D2–D3): one Drizzle
// definition, used by SQLite on phones, in the browser and on the relay.
//
// Rules every table follows (see the proviso-schema-change skill):
//   - `id` is a UUID string made on the device (ids.ts): newId() for ordinary
//     records, contentId() where a natural key exists, a fixed name for
//     single-row settings (SETTINGS_ID).
//   - No hard deletes: `deletedAt` (ISO timestamp) marks a removed row.
//   - No unique constraints besides `id`: two offline devices can't both
//     honour one. Natural keys become content ids instead.
//   - Facts only. Nothing a core calculation can work out is stored.
//   - Additive changes only once released: never rename or repurpose a column.
//   - Column names match the TypeScript keys, so a sync message's column name
//     is the same everywhere.
//   - Timestamps and dates are ISO strings; money is a number of dollars.
//
// People: the household has up to two adults, keyed 'p1' and 'p2'. Their
// names live in householdSettings; records about a person (HELP, super
// history, investment parcels, work patterns) store the key, so renaming
// someone never detaches their history.

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

/** Bumped by every migration. Travels with each sync message and export. */
export const SCHEMA_VERSION = 1

export type PersonKey = 'p1' | 'p2'
export const PERSON_KEYS: readonly PersonKey[] = ['p1', 'p2']

/** Fixed ids for single-row settings tables. */
export const SETTINGS_ID = {
  household:   'household',
  income:      'income',
  mortgage:    'mortgage',
  childcare:   'childcare',
  projections: 'projections',
  super:       'super',
  rent:        'rent',
  actuals:     'actuals',
} as const

const id        = () => text('id').primaryKey()
const deletedAt = () => text('deletedAt')
const bool      = (name: string) => integer(name, { mode: 'boolean' })

// ── Household space: synced between the household's adults' devices ──────────

export const householdSettings = sqliteTable('householdSettings', {
  id: id(), deletedAt: deletedAt(),
  person1Name:    text('person1Name').notNull().default('You'),
  person2Name:    text('person2Name').notNull().default('Partner'),
  partnerEnabled: bool('partnerEnabled').notNull().default(false),
  onboardingDone: bool('onboardingDone').notNull().default(false),
})

/** People who use the app. Credentials never live here — devices hold keys. */
export const member = sqliteTable('member', {
  id: id(), deletedAt: deletedAt(),
  name: text('name').notNull(),
  role: text('role', { enum: ['CFO', 'PARTNER', 'CHILD'] }).notNull(),
})

export const expense = sqliteTable('expense', {
  id: id(), deletedAt: deletedAt(),
  cat:  text('cat').notNull(),
  name: text('name').notNull(),
  freq: text('freq', { enum: ['weekly', 'monthly', 'quarterly', 'yearly'] }).notNull(),
  amt:  real('amt').notNull(),
})

/** A yearly bill that lands in a known month (car rego, insurance). */
export const annualExpense = sqliteTable('annualExpense', {
  id: id(), deletedAt: deletedAt(),
  name:  text('name').notNull(),
  cat:   text('cat').notNull(),
  amt:   real('amt').notNull(),
  month: integer('month').notNull(),  // 1–12
})

export const debt = sqliteTable('debt', {
  id: id(), deletedAt: deletedAt(),
  name: text('name').notNull(),
  amt:  real('amt').notNull(),
})

export const asset = sqliteTable('asset', {
  id: id(), deletedAt: deletedAt(),
  name:     text('name').notNull(),
  amt:      real('amt').notNull(),
  isOffset: bool('isOffset').notNull().default(false),  // counts as cash; offsets the mortgage
})

export const mortgageSettings = sqliteTable('mortgageSettings', {
  id: id(), deletedAt: deletedAt(),
  balance:   real('balance').notNull().default(0),
  rate:      real('rate').notNull().default(6),
  payment:   real('payment').notNull().default(0),
  offsetBal: real('offsetBal').notNull().default(0),
  endDate:   text('endDate').notNull().default(''),
})

export const childcareSettings = sqliteTable('childcareSettings', {
  id: id(), deletedAt: deletedAt(),
  enabled:     bool('enabled').notNull().default(false),
  costPerDay:  real('costPerDay').notNull().default(130),
  daysPerWeek: integer('daysPerWeek').notNull().default(3),
  numChildren: integer('numChildren').notNull().default(1),
})

export const incomeSettings = sqliteTable('incomeSettings', {
  id: id(), deletedAt: deletedAt(),
  taxMode:           bool('taxMode').notNull().default(true),
  person1FTE:        real('person1FTE').notNull().default(0),  // full-time salary
  person2FTE:        real('person2FTE').notNull().default(0),
  person1HasHELP:    bool('person1HasHELP').notNull().default(false),
  person2HasHELP:    bool('person2HasHELP').notNull().default(false),
  person1MonthlyNet: real('person1MonthlyNet').notNull().default(0),
  person2MonthlyNet: real('person2MonthlyNet').notNull().default(0),
  person1Age:        integer('person1Age').notNull().default(30),
  person2Age:        integer('person2Age').notNull().default(30),
})

/** Days a week each person works, from a given year (replaces Person1Phase / Person2Phase). */
export const workPhase = sqliteTable('workPhase', {
  id: id(), deletedAt: deletedAt(),
  person: text('person', { enum: ['p1', 'p2'] }).notNull(),
  year:   integer('year').notNull(),
  days:   integer('days').notNull(),
})

export const projectionSettings = sqliteTable('projectionSettings', {
  id: id(), deletedAt: deletedAt(),
  person1Growth:        real('person1Growth').notNull().default(3.5),
  person2Growth:        real('person2Growth').notNull().default(3.0),
  expInflNear:          real('expInflNear').notNull().default(4.0),
  expInfl:              real('expInfl').notNull().default(2.5),
  childcareInfl:        real('childcareInfl').notNull().default(6.0),
  propGrowth:           real('propGrowth').notNull().default(3.5),
  savingsRate:          real('savingsRate').notNull().default(10.0),
  investReturn:         real('investReturn').notNull().default(3.5),
  projYears:            integer('projYears').notNull().default(20),
  schoolFeesOn:         bool('schoolFeesOn').notNull().default(false),
  sfC1Start:            integer('sfC1Start').notNull().default(2032),
  sfC1ExitIdx:          integer('sfC1ExitIdx').notNull().default(13),
  sfC2Start:            integer('sfC2Start').notNull().default(2035),
  sfC2ExitIdx:          integer('sfC2ExitIdx').notNull().default(13),
  sfInfl:               real('sfInfl').notNull().default(5.0),
  sfPresetKey:          text('sfPresetKey'),  // e.g. "vic|independent"; null = custom schedule
  parentalLeaveEnabled: bool('parentalLeaveEnabled').notNull().default(true),
})

export const lifePhase = sqliteTable('lifePhase', {
  id: id(), deletedAt: deletedAt(),
  name:       text('name').notNull(),
  type:       text('type', { enum: ['recurring', 'oneoff', 'phaseout'] }).notNull(),
  monthlyAmt: real('monthlyAmt').notNull(),
  startYear:  integer('startYear').notNull(),
  endYear:    integer('endYear').notNull(),
  cat:        text('cat').notNull(),
  enabled:    bool('enabled').notNull().default(true),
  sortOrder:  integer('sortOrder').notNull().default(0),
})

export const oneOff = sqliteTable('oneOff', {
  id: id(), deletedAt: deletedAt(),
  name: text('name').notNull(),
  amt:  real('amt').notNull(),
  year: integer('year').notNull(),
})

/** A bank transaction. id = contentId('transaction', date, description, amt), so re-importing a statement never duplicates. */
export const transaction = sqliteTable('transaction', {
  id: id(), deletedAt: deletedAt(),
  date:        text('date').notNull(),         // as on the statement (dd/mm/yyyy)
  ym:          text('ym').notNull(),           // YYYY-MM
  description: text('description').notNull(),
  amt:         real('amt').notNull(),
  cat:         text('cat').notNull(),
  originalCat: text('originalCat').notNull(),
  catSource:   text('catSource', { enum: ['custom', 'system'] }).notNull(),
  lumpy:       bool('lumpy').notNull().default(false),
  importedAt:  text('importedAt').notNull(),
})

/** id = contentId('categorisationRule', pattern). */
export const categorisationRule = sqliteTable('categorisationRule', {
  id: id(), deletedAt: deletedAt(),
  pattern: text('pattern').notNull(),
  cat:     text('cat').notNull(),
  source:  text('source').notNull().default('user'),
  hits:    integer('hits').notNull().default(0),
})

/** id = contentId('suggestionState', cat). */
export const suggestionState = sqliteTable('suggestionState', {
  id: id(), deletedAt: deletedAt(),
  cat:    text('cat').notNull(),
  status: text('status').notNull().default('pending'),
})

export const actualsSettings = sqliteTable('actualsSettings', {
  id: id(), deletedAt: deletedAt(),
  useActualsProjections: bool('useActualsProjections').notNull().default(false),
})

/** id = contentId('schoolFeeLevel', level). */
export const schoolFeeLevel = sqliteTable('schoolFeeLevel', {
  id: id(), deletedAt: deletedAt(),
  level:   text('level').notNull(),
  tuition: real('tuition').notNull().default(0),
  fixed:   real('fixed').notNull().default(0),
})

/** id = contentId('helpDebtDetail', person, financialYearEnding). */
export const helpDebtDetail = sqliteTable('helpDebtDetail', {
  id: id(), deletedAt: deletedAt(),
  person:              text('person', { enum: ['p1', 'p2'] }).notNull(),
  financialYearEnding: integer('financialYearEnding').notNull(),
  openingFyBalance:    real('openingFyBalance').notNull().default(0),
  estimatedWithheld:   real('estimatedWithheld').notNull().default(0),
  voluntaryRepayments: real('voluntaryRepayments').notNull().default(0),
  cpiRate:             real('cpiRate').notNull().default(3.5),
})

export const superSettings = sqliteTable('superSettings', {
  id: id(), deletedAt: deletedAt(),
  person1Balance:            real('person1Balance').notNull().default(0),
  person1RetirementAge:      integer('person1RetirementAge').notNull().default(67),
  person1AdditionalContribs: real('person1AdditionalContribs').notNull().default(0),
  person2Balance:            real('person2Balance').notNull().default(0),
  person2RetirementAge:      integer('person2RetirementAge').notNull().default(67),
  person2AdditionalContribs: real('person2AdditionalContribs').notNull().default(0),
  sgRate:                    real('sgRate').notNull().default(0.12),
  investmentReturn:          real('investmentReturn').notNull().default(0.06),
  fundFeePercent:            real('fundFeePercent').notNull().default(0.005),
  inflationRate:             real('inflationRate').notNull().default(0.04),
  desiredRetirementIncome:   real('desiredRetirementIncome').notNull().default(60000),
})

/** id = contentId('superHistory', person, financialYearEnding). */
export const superHistory = sqliteTable('superHistory', {
  id: id(), deletedAt: deletedAt(),
  person:               text('person', { enum: ['p1', 'p2'] }).notNull(),
  financialYearEnding:  integer('financialYearEnding').notNull(),
  concessionalCap:      real('concessionalCap').notNull(),
  concessionalUtilised: real('concessionalUtilised').notNull(),
  totalSuperBalance:    real('totalSuperBalance').notNull(),
})

export const investmentParcel = sqliteTable('investmentParcel', {
  id: id(), deletedAt: deletedAt(),
  person:        text('person', { enum: ['p1', 'p2'] }).notNull(),  // owner: drives the CGT rate
  name:          text('name').notNull(),
  quantity:      real('quantity').notNull().default(0),
  purchasePrice: real('purchasePrice').notNull().default(0),  // per unit
  purchaseDate:  text('purchaseDate').notNull(),               // ISO date
  currentPrice:  real('currentPrice').notNull().default(0),
  sellYear:      integer('sellYear'),
})

export const netWorthSnapshot = sqliteTable('netWorthSnapshot', {
  id: id(), deletedAt: deletedAt(),
  takenAt:     text('takenAt').notNull(),
  totalAssets: real('totalAssets'),  // null for manual entries
  totalDebts:  real('totalDebts'),
  netWorth:    real('netWorth').notNull(),
  source:      text('source', { enum: ['auto', 'manual'] }).notNull().default('auto'),
})

export const donation = sqliteTable('donation', {
  id: id(), deletedAt: deletedAt(),
  charity:       text('charity').notNull(),
  abn:           text('abn').notNull().default(''),
  amount:        real('amount').notNull(),
  date:          text('date').notNull(),  // YYYY-MM-DD
  financialYr:   integer('financialYr').notNull(),
  source:        text('source', { enum: ['manual', 'imported'] }).notNull().default('manual'),
  transactionId: text('transactionId'),
  notes:         text('notes').notNull().default(''),
})

export const workExpense = sqliteTable('workExpense', {
  id: id(), deletedAt: deletedAt(),
  description:   text('description').notNull(),
  amount:        real('amount').notNull(),
  date:          text('date').notNull(),  // YYYY-MM-DD
  category:      text('category').notNull().default('Other'),
  financialYr:   integer('financialYr').notNull(),
  source:        text('source', { enum: ['manual', 'imported'] }).notNull().default('manual'),
  transactionId: text('transactionId'),
  receiptRef:    text('receiptRef').notNull().default(''),
  notes:         text('notes').notNull().default(''),
})

export const rentSettings = sqliteTable('rentSettings', {
  id: id(), deletedAt: deletedAt(),
  enabled:                bool('enabled').notNull().default(false),
  monthlyRent:            real('monthlyRent').notNull().default(0),
  annualIncreaseRate:     real('annualIncreaseRate').notNull().default(5.0),
  purchasePlanEnabled:    bool('purchasePlanEnabled').notNull().default(false),
  targetPurchaseYear:     integer('targetPurchaseYear').notNull().default(2031),
  targetPropertyValue:    real('targetPropertyValue').notNull().default(800000),
  depositPct:             real('depositPct').notNull().default(20.0),
  depositFromCash:        real('depositFromCash').notNull().default(0),
  depositFromInvestments: real('depositFromInvestments').notNull().default(0),
  newMortgageRate:        real('newMortgageRate').notNull().default(6.0),
  newMortgageTermYrs:     integer('newMortgageTermYrs').notNull().default(30),
})

// ── Pocket-money space: shared between the parents and that child only ──────
// Kept apart from household finances (decision D6): a child's device syncs
// only this space, so it never receives the household's figures.

export const allowanceSchedule = sqliteTable('allowanceSchedule', {
  id: id(), deletedAt: deletedAt(),
  memberId:  text('memberId').notNull(),
  amount:    real('amount').notNull(),
  dayOfWeek: integer('dayOfWeek').notNull().default(5),  // 0 = Sunday … 6 = Saturday
})

export const pocketMoneyTx = sqliteTable('pocketMoneyTx', {
  id: id(), deletedAt: deletedAt(),
  memberId:    text('memberId').notNull(),
  amount:      real('amount').notNull(),  // positive = in, negative = out
  description: text('description').notNull(),
  date:        text('date').notNull(),    // YYYY-MM-DD
  category:    text('category').notNull().default('general'),
})

// ── Registry ─────────────────────────────────────────────────────────────────

/** Tables in the household space, in an order that respects references. */
export const HOUSEHOLD_TABLES = {
  householdSettings, member, expense, annualExpense, debt, asset, mortgageSettings,
  childcareSettings, incomeSettings, workPhase, projectionSettings, lifePhase, oneOff,
  transaction, categorisationRule, suggestionState, actualsSettings, schoolFeeLevel,
  helpDebtDetail, superSettings, superHistory, investmentParcel, netWorthSnapshot,
  donation, workExpense, rentSettings,
} as const

/** Tables in a pocket-money space. */
export const POCKET_MONEY_TABLES = { allowanceSchedule, pocketMoneyTx } as const

export type HouseholdTableName  = keyof typeof HOUSEHOLD_TABLES
export type PocketMoneyTableName = keyof typeof POCKET_MONEY_TABLES

/** Row types, e.g. HouseholdRow<'expense'>. */
export type HouseholdRow<T extends HouseholdTableName>   = (typeof HOUSEHOLD_TABLES)[T]['$inferSelect']
export type PocketMoneyRow<T extends PocketMoneyTableName> = (typeof POCKET_MONEY_TABLES)[T]['$inferSelect']
