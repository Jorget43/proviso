'use client'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { toMonthly, fmt, fmtS } from '@/lib/formatting'
import { calcAfterTax } from '@/lib/tax'
import { computeChildcare } from '@/lib/childcare'
import { CATS } from '@/lib/constants'
import MetricCard from '@/components/ui/MetricCard'
import ReadOnlyFence from '@/components/ui/ReadOnlyFence'
import IncomePanel, { type IncomeSettings } from './IncomePanel'
import ExpenseTable, { type Expense } from './ExpenseTable'
import ChildcarePanel, { type ChildcareSettings } from './ChildcarePanel'
import SpendDonut from './SpendDonut'
import MonthlySummary from './MonthlySummary'
import LumpyMonths from './LumpyMonths'

const CHILDCARE_CAT  = 'Children'
const CHILDCARE_NAME = 'Childcare'

interface BudgetClientProps {
  canEdit: boolean
  initialExpenses: Expense[]
  initialIncome: IncomeSettings
  initialChildcare: ChildcareSettings
  currentDays: number
  cashOnHand: number
  person1Name: string
  person2Name: string
}

export default function BudgetClient({
  canEdit,
  initialExpenses,
  initialIncome,
  initialChildcare,
  currentDays,
  cashOnHand,
  person1Name,
  person2Name,
}: BudgetClientProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [income, setIncome] = useState<IncomeSettings>(initialIncome)
  const [childcare, setChildcare] = useState<ChildcareSettings>(initialChildcare)

  // Combined gross family income drives the CCS taper (Person1 full FTE + Person2 pro-rata).
  const familyIncome = useMemo(
    () => income.jorgeFTE + income.graceFTE * (currentDays / 5),
    [income.jorgeFTE, income.graceFTE, currentDays],
  )

  const jorgeNet = useMemo(() => {
    if (income.taxMode) return calcAfterTax(income.jorgeFTE, false) / 12
    return income.jorgeMonthlyNet
  }, [income])

  const graceNet = useMemo(() => {
    if (income.taxMode) {
      return calcAfterTax(income.graceFTE * (currentDays / 5), income.graceHasHELP) / 12
    }
    return income.graceMonthlyNet
  }, [income, currentDays])

  const monthlyIncome = jorgeNet + graceNet

  const monthlyExpenses = useMemo(
    () => expenses.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0),
    [expenses],
  )

  const catMonthly = useMemo(() => {
    const m: Record<string, number> = {}
    CATS.forEach(c => { m[c] = 0 })
    expenses.forEach(e => { m[e.cat] = (m[e.cat] ?? 0) + toMonthly(e.amt, e.freq) })
    return m
  }, [expenses])

  const delta = monthlyIncome - monthlyExpenses
  const savingsRate = monthlyIncome > 0 ? delta / monthlyIncome * 100 : 0

  const addExpense = useCallback(async (cat: string = 'Fun') => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cat, name: 'New item', freq: 'monthly', amt: 0 }),
    })
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

  // Keep a managed "Childcare" budget line in sync with the CCS calculation.
  // When enabled, its amount is the net out-of-pocket monthly cost; when
  // disabled, the managed line is removed.
  const childcareSyncing = useRef(false)
  useEffect(() => {
    const managed = expenses.find(e => e.cat === CHILDCARE_CAT && e.name === CHILDCARE_NAME)
    if (childcare.enabled) {
      const net = Math.round(computeChildcare({
        costPerDay:   childcare.costPerDay,
        daysPerWeek:  childcare.daysPerWeek,
        numChildren:  childcare.numChildren,
        familyIncome,
      }).netMonthly)
      if (managed) {
        if (Math.round(managed.amt) !== net) {
          setExpenses(prev => prev.map(e => e.id === managed.id ? { ...e, amt: net } : e))
          fetch(`/api/expenses/${managed.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amt: net }),
          })
        }
      } else if (!childcareSyncing.current) {
        childcareSyncing.current = true
        fetch('/api/expenses', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cat: CHILDCARE_CAT, name: CHILDCARE_NAME, freq: 'monthly', amt: net }),
        })
          .then(r => r.json())
          .then((created: Expense) => setExpenses(prev => [...prev, created]))
          .finally(() => { childcareSyncing.current = false })
      }
    } else if (managed) {
      setExpenses(prev => prev.filter(e => e.id !== managed.id))
      fetch(`/api/expenses/${managed.id}`, { method: 'DELETE' })
    }
  }, [childcare, familyIncome, expenses])

  return (
    <div className="page">
      <ReadOnlyFence canEdit={canEdit}>
        <IncomePanel
          income={income}
          currentDays={currentDays}
          onUpdate={updateIncome}
          person1Name={person1Name}
          person2Name={person2Name}
        />
      </ReadOnlyFence>

      <div className="metrics">
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
          sub="amortised"
        />
        <MetricCard
          label="Monthly delta"
          value={fmtS(delta)}
          color={delta >= 0 ? 'green' : 'red'}
          sub="surplus / deficit"
        />
        <MetricCard
          label="Annual surplus"
          value={fmtS(delta * 12)}
          color={delta >= 0 ? 'green' : 'red'}
          sub="if unchanged"
        />
        <MetricCard
          label="Savings rate"
          value={`${savingsRate.toFixed(1)}%`}
          color={savingsRate >= 20 ? 'green' : savingsRate >= 0 ? 'blue' : 'red'}
          sub="of income"
        />
      </div>

      <ReadOnlyFence canEdit={canEdit}>
        <ExpenseTable
          expenses={expenses}
          onAdd={addExpense}
          onUpdate={updateExpense}
          onDelete={deleteExpense}
        />
      </ReadOnlyFence>

      <ReadOnlyFence canEdit={canEdit}>
        <ChildcarePanel
          settings={childcare}
          familyIncome={familyIncome}
          onUpdate={updateChildcare}
        />
      </ReadOnlyFence>

      <div className="two-col">
        <SpendDonut catMonthly={catMonthly} />
        <MonthlySummary
          catMonthly={catMonthly}
          monthlyIncome={monthlyIncome}
          monthlyExpenses={monthlyExpenses}
          cashOnHand={cashOnHand}
        />
      </div>

      <LumpyMonths />
    </div>
  )
}
