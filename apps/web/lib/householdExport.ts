// Exports this NAS household in the local-first format (packages/core:
// schema.ts, householdExport.ts). Used to move a household into the app, and
// for "Download all your data" in Settings.
//
// Split in two so the mapping is testable without a database:
//   readLegacyHousehold()  — every Prisma table the new model carries over
//   mapLegacyHousehold()   — pure: legacy rows → the new schema
//
// IDs: rows with a natural key get contentId() of that key (a transaction's
// date + description + amount, a rule's pattern…), matching what the app will
// produce, so data imported twice — or a statement imported on a phone too —
// merges instead of duplicating. Every other row gets an id derived from this
// household's id and its legacy integer id, so re-exporting is stable.
//
// Not exported: sign-in data (users' passwords, 2FA, passkeys, sessions), the
// audit log, and server bookkeeping. People come across as `member` rows.

import type {
  Expense, AnnualExpense, Debt, Asset, MortgageSettings, ChildcareSettings, IncomeSettings,
  Person1Phase, Person2Phase, ProjectionSettings, LifePhase, OneOff, Transaction,
  CategoriationRule, SuggestionState, ActualsSettings, HouseholdSettings, SchoolFeeLevel,
  HelpDebtDetail, SuperSettings, SuperHistory, InvestmentParcel, User, AllowanceSchedule,
  PocketMoneyTx, NetWorthSnapshot, Donation, WorkExpense, RentSettings,
} from '@prisma/client'
import { prisma } from './db'
import { contentId, newId } from '@proviso/core/ids'
import { SCHEMA_VERSION, SETTINGS_ID, type PersonKey } from '@proviso/core/schema'
import {
  EXPORT_FORMAT, EXPORT_VERSION, emptyHouseholdTables, emptyPocketMoneyTables, parseHouseholdExport,
  type HouseholdExport,
} from '@proviso/core/householdExport'

export interface LegacyHousehold {
  householdSettings:  HouseholdSettings | null
  users:              Pick<User, 'id' | 'name' | 'role'>[]
  expenses:           Expense[]
  annualExpenses:     AnnualExpense[]
  debts:              Debt[]
  assets:             Asset[]
  mortgage:           MortgageSettings | null
  childcare:          ChildcareSettings | null
  income:             IncomeSettings | null
  person1Phases:      Person1Phase[]
  person2Phases:      Person2Phase[]
  projection:         ProjectionSettings | null
  lifePhases:         LifePhase[]
  oneOffs:            OneOff[]
  transactions:       Transaction[]
  rules:              CategoriationRule[]
  suggestions:        SuggestionState[]
  actuals:            ActualsSettings | null
  schoolFeeLevels:    SchoolFeeLevel[]
  helpDetails:        HelpDebtDetail[]
  superSettings:      SuperSettings | null
  superHistory:       SuperHistory[]
  parcels:            InvestmentParcel[]
  netWorthSnapshots:  NetWorthSnapshot[]
  donations:          Donation[]
  workExpenses:       WorkExpense[]
  rent:               RentSettings | null
  allowances:         AllowanceSchedule[]
  pocketMoney:        PocketMoneyTx[]
}

export async function readLegacyHousehold(): Promise<LegacyHousehold> {
  const [
    householdSettings, users, expenses, annualExpenses, debts, assets, mortgage, childcare, income,
    person1Phases, person2Phases, projection, lifePhases, oneOffs, transactions, rules, suggestions,
    actuals, schoolFeeLevels, helpDetails, superSettings, superHistory, parcels, netWorthSnapshots,
    donations, workExpenses, rent, allowances, pocketMoney,
  ] = await Promise.all([
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.user.findMany({ select: { id: true, name: true, role: true }, orderBy: { id: 'asc' } }),
    prisma.expense.findMany({ orderBy: { id: 'asc' } }),
    prisma.annualExpense.findMany({ orderBy: { id: 'asc' } }),
    prisma.debt.findMany({ orderBy: { id: 'asc' } }),
    prisma.asset.findMany({ orderBy: { id: 'asc' } }),
    prisma.mortgageSettings.findUnique({ where: { id: 1 } }),
    prisma.childcareSettings.findUnique({ where: { id: 1 } }),
    prisma.incomeSettings.findUnique({ where: { id: 1 } }),
    prisma.person1Phase.findMany({ orderBy: { id: 'asc' } }),
    prisma.person2Phase.findMany({ orderBy: { id: 'asc' } }),
    prisma.projectionSettings.findUnique({ where: { id: 1 } }),
    prisma.lifePhase.findMany({ orderBy: { id: 'asc' } }),
    prisma.oneOff.findMany({ orderBy: { id: 'asc' } }),
    prisma.transaction.findMany({ orderBy: { id: 'asc' } }),
    prisma.categoriationRule.findMany({ orderBy: { id: 'asc' } }),
    prisma.suggestionState.findMany({ orderBy: { id: 'asc' } }),
    prisma.actualsSettings.findUnique({ where: { id: 1 } }),
    prisma.schoolFeeLevel.findMany({ orderBy: { id: 'asc' } }),
    prisma.helpDebtDetail.findMany({ orderBy: { id: 'asc' } }),
    prisma.superSettings.findUnique({ where: { id: 1 } }),
    prisma.superHistory.findMany({ orderBy: { id: 'asc' } }),
    prisma.investmentParcel.findMany({ orderBy: { id: 'asc' } }),
    prisma.netWorthSnapshot.findMany({ orderBy: { id: 'asc' } }),
    prisma.donation.findMany({ orderBy: { id: 'asc' } }),
    prisma.workExpense.findMany({ orderBy: { id: 'asc' } }),
    prisma.rentSettings.findUnique({ where: { id: 1 } }),
    prisma.allowanceSchedule.findMany({ orderBy: { id: 'asc' } }),
    prisma.pocketMoneyTx.findMany({ orderBy: { id: 'asc' } }),
  ])
  return {
    householdSettings, users, expenses, annualExpenses, debts, assets, mortgage, childcare, income,
    person1Phases, person2Phases, projection, lifePhases, oneOffs, transactions, rules, suggestions,
    actuals, schoolFeeLevels, helpDetails, superSettings, superHistory, parcels, netWorthSnapshots,
    donations, workExpenses, rent, allowances, pocketMoney,
  }
}

/** The household's stable id, created on first use. */
export async function ensureHouseholdId(): Promise<string> {
  const hs = await prisma.householdSettings.findUnique({ where: { id: 1 }, select: { householdId: true } })
  if (hs?.householdId) return hs.householdId
  const id = newId()
  await prisma.householdSettings.upsert({ where: { id: 1 }, update: { householdId: id }, create: { id: 1, householdId: id } })
  return id
}

export async function exportHousehold(appVersion: string, now = new Date()): Promise<HouseholdExport> {
  const householdId = await ensureHouseholdId()
  const legacy = await readLegacyHousehold()
  // Validate before handing it out: a file the app can't import is worse than an error now.
  return parseHouseholdExport(JSON.parse(JSON.stringify(mapLegacyHousehold(legacy, { householdId, exportedAt: now, appVersion }))))
}

const iso = (d: Date) => d.toISOString()

export function mapLegacyHousehold(
  L: LegacyHousehold,
  opts: { householdId: string; exportedAt: Date; appVersion: string },
): HouseholdExport {
  const { householdId } = opts
  const notes: string[] = []
  const legacyId = (table: string, id: number) => contentId(`legacy:${householdId}`, table, id)
  const t = emptyHouseholdTables()
  const live = { id: '', deletedAt: null }  // spread first, then set id

  // People: records keyed by display name become p1 / p2.
  const hs = L.householdSettings
  const p1Name = (hs?.person1Name ?? 'You').trim().toLowerCase()
  const p2Name = (hs?.person2Name ?? 'Partner').trim().toLowerCase()
  const unmatched = new Map<string, number>()
  const person = (name: string, what: string): PersonKey => {
    const n = name.trim().toLowerCase()
    if (n === p1Name) return 'p1'
    if (n === p2Name) return 'p2'
    unmatched.set(`${what} for “${name}”`, (unmatched.get(`${what} for “${name}”`) ?? 0) + 1)
    return 'p1'
  }

  if (hs) {
    t.householdSettings.push({ ...live, id: SETTINGS_ID.household,
      person1Name: hs.person1Name, person2Name: hs.person2Name,
      partnerEnabled: hs.partnerEnabled, onboardingDone: hs.onboardingDone })
  }

  const memberIds = new Map<number, string>()
  for (const u of L.users) {
    const id = legacyId('member', u.id)
    memberIds.set(u.id, id)
    const role = u.role === 'CFO' || u.role === 'PARTNER' || u.role === 'CHILD' ? u.role : 'PARTNER'
    if (role !== u.role) notes.push(`${u.name}’s role “${u.role}” isn’t recognised; brought across as Partner.`)
    t.member.push({ ...live, id, name: u.name, role })
  }

  for (const e of L.expenses) {
    const freq = e.freq === 'weekly' || e.freq === 'monthly' || e.freq === 'quarterly' || e.freq === 'yearly' ? e.freq : 'monthly'
    if (freq !== e.freq) notes.push(`“${e.name}” had an unknown frequency “${e.freq}”; brought across as monthly.`)
    t.expense.push({ ...live, id: legacyId('expense', e.id), cat: e.cat, name: e.name, freq, amt: e.amt })
  }
  for (const a of L.annualExpenses) t.annualExpense.push({ ...live, id: legacyId('annualExpense', a.id), name: a.name, cat: a.cat, amt: a.amt, month: a.month })
  for (const d of L.debts) t.debt.push({ ...live, id: legacyId('debt', d.id), name: d.name, amt: d.amt })
  for (const a of L.assets) t.asset.push({ ...live, id: legacyId('asset', a.id), name: a.name, amt: a.amt, isOffset: a.isOffset })

  if (L.mortgage) {
    const { balance, rate, payment, offsetBal, endDate } = L.mortgage
    t.mortgageSettings.push({ ...live, id: SETTINGS_ID.mortgage, balance, rate, payment, offsetBal, endDate })
  }
  if (L.childcare) {
    const { enabled, costPerDay, daysPerWeek, numChildren } = L.childcare
    t.childcareSettings.push({ ...live, id: SETTINGS_ID.childcare, enabled, costPerDay, daysPerWeek, numChildren })
  }
  if (L.income) {
    const { id: _id, ...rest } = L.income
    void _id
    t.incomeSettings.push({ ...live, ...rest, id: SETTINGS_ID.income })
  }
  for (const p of L.person1Phases) t.workPhase.push({ ...live, id: legacyId('person1Phase', p.id), person: 'p1', year: p.year, days: p.days })
  for (const p of L.person2Phases) t.workPhase.push({ ...live, id: legacyId('person2Phase', p.id), person: 'p2', year: p.year, days: p.days })
  if (L.projection) {
    const { id: _id, ...rest } = L.projection
    void _id
    t.projectionSettings.push({ ...live, ...rest, id: SETTINGS_ID.projections })
  }
  for (const p of L.lifePhases) {
    const type = p.type === 'recurring' || p.type === 'oneoff' || p.type === 'phaseout' ? p.type : 'recurring'
    if (type !== p.type) notes.push(`Life phase “${p.name}” had an unknown type “${p.type}”; brought across as recurring.`)
    t.lifePhase.push({ ...live, id: legacyId('lifePhase', p.id), name: p.name, type, monthlyAmt: p.monthlyAmt,
      startYear: p.startYear, endYear: p.endYear, cat: p.cat, enabled: p.enabled, sortOrder: p.sortOrder })
  }
  for (const o of L.oneOffs) t.oneOff.push({ ...live, id: legacyId('oneOff', o.id), name: o.name, amt: o.amt, year: o.year })

  const txnIds = new Map<number, string>()
  for (const x of L.transactions) {
    const id = contentId('transaction', x.dateStr, x.desc, x.amt)
    txnIds.set(x.id, id)
    t.transaction.push({ ...live, id, date: x.dateStr, ym: x.ym, description: x.desc, amt: x.amt, cat: x.cat,
      originalCat: x.originalCat, catSource: x.catSource === 'custom' ? 'custom' : 'system', lumpy: x.lumpy, importedAt: iso(x.importedAt) })
  }
  for (const r of L.rules) t.categorisationRule.push({ ...live, id: contentId('categorisationRule', r.pattern), pattern: r.pattern, cat: r.cat, source: r.source, hits: r.hits })
  for (const s of L.suggestions) t.suggestionState.push({ ...live, id: contentId('suggestionState', s.cat), cat: s.cat, status: s.status })
  if (L.actuals) t.actualsSettings.push({ ...live, id: SETTINGS_ID.actuals, useActualsProjections: L.actuals.useActualsProjections })
  for (const l of L.schoolFeeLevels) t.schoolFeeLevel.push({ ...live, id: contentId('schoolFeeLevel', l.level), level: l.level, tuition: l.tuition, fixed: l.fixed })

  // Person + financial year is the natural key (it's what the id is made
  // from). If two legacy names land on the same person — an unmatched name
  // falls back to p1 — keep the most recently updated record.
  const newest = <R extends { id: string }>(rows: { row: R; updated: Date }[], what: string): R[] => {
    const keep = new Map<string, { row: R; updated: Date }>()
    for (const r of rows) {
      const prev = keep.get(r.row.id)
      if (prev) notes.push(`Two ${what} records for the same person and year; kept the most recently updated.`)
      if (!prev || r.updated >= prev.updated) keep.set(r.row.id, r)
    }
    return [...keep.values()].map(r => r.row)
  }
  t.helpDebtDetail.push(...newest(L.helpDetails.map(h => {
    const p = person(h.member, 'HELP record')
    return { updated: h.updatedAt, row: { ...live, id: contentId('helpDebtDetail', p, h.financialYearEnding), person: p,
      financialYearEnding: h.financialYearEnding, openingFyBalance: h.openingFyBalance, estimatedWithheld: h.estimatedWithheld,
      voluntaryRepayments: h.voluntaryRepayments, cpiRate: h.cpiRate } }
  }), 'HELP'))

  if (L.superSettings) {
    const s = L.superSettings
    t.superSettings.push({ ...live, id: SETTINGS_ID.super,
      person1Balance: s.currentBalance, person1RetirementAge: s.retirementAge, person1AdditionalContribs: s.additionalContribs,
      person2Balance: s.partnerBalance, person2RetirementAge: s.partnerRetirementAge, person2AdditionalContribs: s.partnerAdditionalContribs,
      sgRate: s.sgRate, investmentReturn: s.investmentReturn, fundFeePercent: s.fundFeePercent,
      inflationRate: s.inflationRate, desiredRetirementIncome: s.desiredRetirementIncome,
      drawdownStrategy: s.drawdownStrategy, drawdownPct: s.drawdownPct })
  }
  t.superHistory.push(...newest(L.superHistory.map(h => {
    const p = person(h.member, 'super history')
    return { updated: h.updatedAt, row: { ...live, id: contentId('superHistory', p, h.financialYearEnding), person: p,
      financialYearEnding: h.financialYearEnding, concessionalCap: h.concessionalCap,
      concessionalUtilised: h.concessionalUtilised, totalSuperBalance: h.totalSuperBalance } }
  }), 'super history'))

  for (const p of L.parcels) {
    t.investmentParcel.push({ ...live, id: legacyId('investmentParcel', p.id), person: person(p.member, 'Investment parcel'),
      name: p.name, quantity: p.quantity, purchasePrice: p.purchasePrice, purchaseDate: p.purchaseDate,
      currentPrice: p.currentPrice, sellYear: p.sellYear })
  }
  for (const s of L.netWorthSnapshots) {
    t.netWorthSnapshot.push({ ...live, id: legacyId('netWorthSnapshot', s.id), takenAt: iso(s.takenAt),
      totalAssets: s.totalAssets, totalDebts: s.totalDebts, netWorth: s.netWorth, source: s.source === 'manual' ? 'manual' : 'auto' })
  }
  const linkTxn = (txnId: number | null, what: string) => {
    if (txnId == null) return null
    const id = txnIds.get(txnId)
    if (!id) notes.push(`A ${what} was linked to a bank transaction that no longer exists; the link was dropped.`)
    return id ?? null
  }
  for (const d of L.donations) {
    t.donation.push({ ...live, id: legacyId('donation', d.id), charity: d.charity, abn: d.abn, amount: d.amount, date: d.date,
      financialYr: d.financialYr, source: d.source === 'imported' ? 'imported' : 'manual', transactionId: linkTxn(d.txnId, 'donation'), notes: d.notes })
  }
  for (const w of L.workExpenses) {
    t.workExpense.push({ ...live, id: legacyId('workExpense', w.id), description: w.description, amount: w.amount, date: w.date,
      category: w.category, financialYr: w.financialYr, source: w.source === 'imported' ? 'imported' : 'manual',
      transactionId: linkTxn(w.txnId, 'work expense'), receiptRef: w.receiptRef, notes: w.notes })
  }
  if (L.rent) {
    const { id: _id, ...rest } = L.rent
    void _id
    t.rentSettings.push({ ...live, ...rest, id: SETTINGS_ID.rent })
  }

  // Pocket money: one space per child.
  const spaces = new Map<string, ReturnType<typeof emptyPocketMoneyTables>>()
  const spaceFor = (userId: number) => {
    const memberId = memberIds.get(userId)
    if (!memberId) return null
    if (!spaces.has(memberId)) spaces.set(memberId, emptyPocketMoneyTables())
    return spaces.get(memberId)!
  }
  for (const a of L.allowances) {
    spaceFor(a.userId)?.allowanceSchedule.push({ ...live, id: legacyId('allowanceSchedule', a.id), memberId: memberIds.get(a.userId)!, amount: a.amount, dayOfWeek: a.dayOfWeek })
  }
  for (const x of L.pocketMoney) {
    spaceFor(x.userId)?.pocketMoneyTx.push({ ...live, id: legacyId('pocketMoneyTx', x.id), memberId: memberIds.get(x.userId)!,
      amount: x.amount, description: x.description, date: x.date, category: x.category })
  }

  for (const [what, n] of unmatched) {
    notes.push(`${n} ${what.replace(/^(\w)/, c => c.toUpperCase())} didn’t match either person’s current name; assigned to ${hs?.person1Name ?? 'person 1'}. Check them after importing.`)
  }

  return {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, schemaVersion: SCHEMA_VERSION,
    exportedAt: iso(opts.exportedAt), householdId,
    source: { app: 'proviso-nas', version: opts.appVersion },
    household: t,
    pocketMoney: [...spaces.entries()].map(([memberId, tables]) => ({ memberId, tables })),
    notes,
  }
}
