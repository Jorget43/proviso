'use client'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { fmt, fmtS } from '@/lib/formatting'
import { computeBudgetSummary, isManagedChildcare, CHILDCARE_CAT, CHILDCARE_NAME } from '@/lib/budgetSummary'
import MetricCard from '@/components/ui/MetricCard'
import ReadOnlyFence from '@/components/ui/ReadOnlyFence'
import IncomePanel, { type IncomeSettings } from './IncomePanel'
import ExpenseTable, { type Expense, type AnnualExpense } from './ExpenseTable'
import ChildcarePanel, { type ChildcareSettings } from './ChildcarePanel'
import SpendDonut from './SpendDonut'
import MonthlySummary from './MonthlySummary'
import ExpenseList from './ExpenseList'
import ExpenseSheet, { kindOf, type SheetTarget, type LineDraft, type LineKind } from './ExpenseSheet'
import Panel from '@/components/ui/Panel'

interface RentSettings {
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

interface BudgetClientProps {
  canEdit: boolean
  initialExpenses: Expense[]
  initialIncome: IncomeSettings
  initialChildcare: ChildcareSettings
  initialAnnualExpenses: AnnualExpense[]
  initialRentSettings: RentSettings | null
  person1Days: number
  person2Days: number
  partnerEnabled: boolean
  cashOnHand: number
  person1Name: string
  person2Name: string
}

export default function BudgetClient({
  canEdit,
  initialExpenses,
  initialIncome,
  initialChildcare,
  initialAnnualExpenses,
  initialRentSettings,
  person1Days,
  person2Days,
  partnerEnabled,
  cashOnHand,
  person1Name,
  person2Name,
}: BudgetClientProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [income, setIncome] = useState<IncomeSettings>(initialIncome)
  const [childcare, setChildcare] = useState<ChildcareSettings>(initialChildcare)
  const [annualExpenses, setAnnualExpenses] = useState<AnnualExpense[]>(initialAnnualExpenses)
  const [rentSettings, setRentSettings] = useState<RentSettings | null>(initialRentSettings)

  const {
    familyIncome, person1Net, person2Net, monthlyIncome, childcareNet,
    shownExpenses, monthlyExpenses, catMonthly, delta, savingsRate,
  } = useMemo(() => computeBudgetSummary({
    expenses, annualExpenses, income, childcare,
    rentMonthly: rentSettings?.enabled ? rentSettings.monthlyRent : null,
    person1Days, person2Days, partnerEnabled,
  }), [expenses, annualExpenses, income, childcare, rentSettings, person1Days, person2Days, partnerEnabled])

  // ── Regular expense CRUD ────────────────────────────────────────────────────
  const addExpense = useCallback(async (cat: string = 'Fun') => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cat, name: 'New item', freq: 'monthly', amt: 0 }),
    })
    if (!res.ok) return  // failure is reported by SaveErrorToast
    const created: Expense = await res.json()
    setExpenses(prev => [...prev, created])
  }, [])

  const updateExpense = useCallback(async (id: number, field: string, value: string | number) => {
    const parsed = field === 'amt' ? (parseFloat(String(value)) || 0) : value
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: parsed } : e))
    await fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
  }, [])

  const deleteExpense = useCallback(async (id: number) => {
    setExpenses(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
  }, [])

  // ── Annual expense CRUD ─────────────────────────────────────────────────────
  const createAnnualExpense = useCallback(async (data: { name: string; cat: string; amt: number; month: number }) => {
    const res = await fetch('/api/annual-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save')
    const created: AnnualExpense = await res.json()
    setAnnualExpenses(prev => [...prev, created].sort((a, b) => a.month - b.month))
  }, [])

  const updateAnnualExpense = useCallback(async (id: number, data: { name: string; cat: string; amt: number; month: number }) => {
    const res = await fetch(`/api/annual-expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save')
    const updated: AnnualExpense = await res.json()
    setAnnualExpenses(prev => prev.map(i => i.id === id ? updated : i))
  }, [])

  const deleteAnnualExpense = useCallback(async (id: number) => {
    const res = await fetch(`/api/annual-expenses/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete')
    setAnnualExpenses(prev => prev.filter(i => i.id !== id))
  }, [])

  // ── Income & childcare settings ─────────────────────────────────────────────
  const updateIncome = useCallback(async (patch: Partial<IncomeSettings>) => {
    setIncome(prev => ({ ...prev, ...patch }))
    await fetch('/api/income-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }, [])

  const updateChildcare = useCallback(async (patch: Partial<ChildcareSettings>) => {
    setChildcare(prev => ({ ...prev, ...patch }))
    await fetch('/api/childcare-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }, [])

  // ── Rent settings ───────────────────────────────────────────────────────────
  const updateRentMonthly = useCallback(async (monthlyRent: number) => {
    setRentSettings(prev => prev ? { ...prev, monthlyRent } : prev)
    if (!rentSettings) return
    await fetch('/api/rent-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rentSettings, monthlyRent }),
    })
  }, [rentSettings])

  // ── Edit sheet (phone layout) ───────────────────────────────────────────────
  // The sheet shows its own error message, so these requests opt out of the
  // global SaveErrorToast and throw instead.
  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  const sheetRequest = useCallback(async <T,>(url: string, method: string, body?: unknown): Promise<T | null> => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Handles-Errors': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      let msg = 'Couldn’t save that — please try again.'
      try { msg = (await res.json()).error ?? msg } catch { /* no body */ }
      throw new Error(msg)
    }
    return res.status === 204 ? null : res.json()
  }, [])

  const removeLine = useCallback(async (kind: LineKind, id: number) => {
    if (kind === 'annual') {
      await sheetRequest(`/api/annual-expenses/${id}`, 'DELETE')
      setAnnualExpenses(prev => prev.filter(a => a.id !== id))
    } else {
      await sheetRequest(`/api/expenses/${id}`, 'DELETE')
      setExpenses(prev => prev.filter(e => e.id !== id))
    }
  }, [sheetRequest])

  // Picking "Yearly" + a due month turns a regular line into an annual bill
  // (and back) — a different record, so that's create-new then delete-old.
  const saveLine = useCallback(async (target: SheetTarget, d: LineDraft) => {
    const amt = parseFloat(d.amt) || 0
    if (target.kind === 'rent') { await updateRentMonthly(amt); return }
    const name = d.name.trim()
    const kind = kindOf(d)
    if (kind === 'annual') {
      const body = { name, cat: d.cat, amt, month: d.month }
      if (target.kind === 'annual' && target.id !== null) {
        const updated = await sheetRequest<AnnualExpense>(`/api/annual-expenses/${target.id}`, 'PUT', body)
        if (updated) setAnnualExpenses(prev => prev.map(a => (a.id === updated.id ? updated : a)))
        return
      }
      const created = await sheetRequest<AnnualExpense>('/api/annual-expenses', 'POST', body)
      if (created) setAnnualExpenses(prev => [...prev, created].sort((a, b) => a.month - b.month))
    } else {
      const body = { name, cat: d.cat, freq: d.freq, amt }
      if (target.kind === 'regular' && target.id !== null) {
        const updated = await sheetRequest<Expense>(`/api/expenses/${target.id}`, 'PUT', body)
        if (updated) setExpenses(prev => prev.map(e => (e.id === updated.id ? updated : e)))
        return
      }
      const created = await sheetRequest<Expense>('/api/expenses', 'POST', body)
      if (created) setExpenses(prev => [...prev, created])
    }
    if (target.id !== null) await removeLine(target.kind, target.id)
  }, [sheetRequest, removeLine, updateRentMonthly])

  // ── Childcare managed budget line: persist ──────────────────────────────────
  // Saves the derived line (see shownExpenses). State is only updated once the
  // server answers, so this never triggers a synchronous re-render.
  const childcareSyncing = useRef(false)
  useEffect(() => {
    // Read-only viewers (Partner) can't write — syncing would just 403.
    if (!canEdit || childcareSyncing.current) return
    const managed = expenses.find(isManagedChildcare)
    const json = { 'Content-Type': 'application/json' }
    let request: Promise<void> | null = null
    if (childcareNet !== null && managed && Math.round(managed.amt) !== childcareNet) {
      request = fetch(`/api/expenses/${managed.id}`, { method: 'PUT', headers: json, body: JSON.stringify({ amt: childcareNet }) })
        .then(r => { if (r.ok) setExpenses(prev => prev.map(e => (e.id === managed.id ? { ...e, amt: childcareNet } : e))) })
    } else if (childcareNet !== null && !managed) {
      request = fetch('/api/expenses', {
        method: 'POST', headers: json,
        body: JSON.stringify({ cat: CHILDCARE_CAT, name: CHILDCARE_NAME, freq: 'monthly', amt: childcareNet }),
      })
        .then(r => (r.ok ? r.json() : null))
        .then((created: Expense | null) => { if (created) setExpenses(prev => [...prev, created]) })
    } else if (childcareNet === null && managed) {
      request = fetch(`/api/expenses/${managed.id}`, { method: 'DELETE' })
        .then(r => { if (r.ok) setExpenses(prev => prev.filter(e => e.id !== managed.id)) })
    }
    if (request) {
      childcareSyncing.current = true
      request.finally(() => { childcareSyncing.current = false })
    }
  }, [canEdit, childcareNet, expenses])

  const rentMonthly = rentSettings?.enabled ? rentSettings.monthlyRent : undefined

  return (
    <div className="page">
      <ReadOnlyFence canEdit={canEdit}>
        <IncomePanel
          income={income}
          person1Days={person1Days}
          person2Days={person2Days}
          partnerEnabled={partnerEnabled}
          onUpdate={updateIncome}
          person1Name={person1Name}
          person2Name={person2Name}
          person1Net={person1Net}
          person2Net={person2Net}
        />
      </ReadOnlyFence>

      {/* Phones: one pinned line instead of five metric cards */}
      <div className={`budget-bar ${delta >= 0 ? 'good' : 'bad'}`} aria-label="Monthly summary">
        <span><small>In</small>{fmt(monthlyIncome)}</span>
        <span><small>Out</small>{fmt(monthlyExpenses)}</span>
        <span className="budget-bar-left"><small>{delta >= 0 ? 'Left over' : 'Short'}</small>{fmt(Math.abs(delta))}</span>
      </div>

      <div className="metrics budget-metrics">
        <MetricCard
          label="Monthly income"
          value={fmt(monthlyIncome)}
          color="green"
          sub="after tax"
        />
        <MetricCard
          label="Monthly expenses"
          value={fmt(monthlyExpenses)}
          color="red"
          sub="yearly bills spread out"
        />
        <MetricCard
          label="Left over each month"
          value={fmtS(delta)}
          color={delta >= 0 ? 'green' : 'red'}
          sub={delta >= 0 ? 'surplus' : 'shortfall'}
        />
        <MetricCard
          label="Left over each year"
          value={fmtS(delta * 12)}
          color={delta >= 0 ? 'green' : 'red'}
          sub="if nothing changes"
        />
        <MetricCard
          label="Savings rate"
          value={`${savingsRate.toFixed(1)}%`}
          color={savingsRate >= 20 ? 'green' : savingsRate >= 0 ? 'blue' : 'red'}
          sub="of take-home pay"
        />
      </div>

      <div className="exp-desktop">
        <ReadOnlyFence canEdit={canEdit}>
          <ExpenseTable
            expenses={shownExpenses}
            onAdd={addExpense}
            onUpdate={updateExpense}
            onDelete={deleteExpense}
            annualExpenses={annualExpenses}
            canEdit={canEdit}
            onAnnualAdd={createAnnualExpense}
            onAnnualUpdate={updateAnnualExpense}
            onAnnualDelete={deleteAnnualExpense}
            rentMonthly={rentMonthly}
            onRentUpdate={updateRentMonthly}
          />
        </ReadOnlyFence>
      </div>

      {/* Not inside ReadOnlyFence: view-only members still open categories and
          lines to read them; the sheet itself is locked for them. */}
      <div className="exp-mobile">
        <Panel title="Where it goes" dotColor="var(--red)" rawBody>
          <ExpenseList
            expenses={shownExpenses}
            annualExpenses={annualExpenses}
            rentMonthly={rentMonthly}
            monthlyTotal={monthlyExpenses}
            canEdit={canEdit}
            onOpen={setSheet}
          />
        </Panel>
      </div>
      <ExpenseSheet
        target={sheet}
        canEdit={canEdit}
        onClose={() => setSheet(null)}
        onSave={saveLine}
        onDelete={t => (t.id === null || t.kind === 'rent' ? Promise.resolve() : removeLine(t.kind, t.id))}
      />

      {/* Situational sections appear only when switched on (Settings → Your situation) */}
      {childcare.enabled && (
        <ReadOnlyFence canEdit={canEdit}>
          <ChildcarePanel
            settings={childcare}
            familyIncome={familyIncome}
            onUpdate={updateChildcare}
          />
        </ReadOnlyFence>
      )}

      <div className="two-col">
        <SpendDonut catMonthly={catMonthly} />
        <div className="budget-summary-panel">
          <MonthlySummary
            catMonthly={catMonthly}
            monthlyIncome={monthlyIncome}
            monthlyExpenses={monthlyExpenses}
            cashOnHand={cashOnHand}
          />
        </div>
      </div>

      {canEdit && (!childcare.enabled || !rentSettings?.enabled) && (
        <p className="situation-hint">
          {!childcare.enabled && !rentSettings?.enabled ? 'Paying for childcare, or renting?'
            : !childcare.enabled ? 'Paying for childcare?' : 'Renting?'}{' '}
          <Link href="/settings#situation">Switch it on in Your situation</Link> and it&rsquo;ll show up here.
        </p>
      )}
    </div>
  )
}
