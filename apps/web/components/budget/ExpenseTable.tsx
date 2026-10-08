'use client'
import { CATS } from '@proviso/core/constants'
import { toMonthly, fmt } from '@proviso/core/formatting'
import Panel from '@/components/ui/Panel'
import type { SheetTarget } from './ExpenseSheet'

// Desktop layout for the budget: one table, grouped by category. Regular
// lines edit in place; adding anything, and changing a yearly bill, opens the
// same "Add a cost" sheet the phone layout uses, which asks "How often?"
// (Yearly + a due month makes a yearly bill).

export interface Expense {
  id: number
  cat: string
  name: string
  freq: string
  amt: number
}

export interface AnnualExpense {
  id:    number
  name:  string
  cat:   string
  amt:   number
  month: number
}

const FREQS = ['weekly', 'monthly', 'quarterly', 'yearly']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function nextExpected(month: number): string {
  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const year = month >= thisMonth ? now.getFullYear() : now.getFullYear() + 1
  return `${MONTH_SHORT[month - 1]} ${year}`
}

const addTarget = (cat: string): SheetTarget => ({ kind: 'regular', id: null, draft: { name: '', cat, freq: 'monthly', amt: '', month: 0 } })

interface ExpenseTableProps {
  expenses: Expense[]
  onUpdate: (id: number, field: string, value: string | number) => void
  onDelete: (id: number) => void
  annualExpenses: AnnualExpense[]
  canEdit: boolean
  onAnnualDelete: (id: number) => Promise<void>
  /** Opens the add / edit sheet. */
  onOpen: (target: SheetTarget) => void
  rentMonthly?: number
  onRentUpdate?: (monthly: number) => Promise<void>
}

export default function ExpenseTable({
  expenses, onUpdate, onDelete, annualExpenses, canEdit, onAnnualDelete, onOpen, rentMonthly, onRentUpdate,
}: ExpenseTableProps) {
  const extraCats = [...new Set([...expenses, ...annualExpenses].map(e => e.cat))].filter(c => !(CATS as readonly string[]).includes(c))
  const cats = [...CATS, ...extraCats]

  return (
    <Panel title="Expenses" dotColor="var(--red)" rawBody>
      <div style={{ overflowX: 'auto' }}>
        <table className="expense-table">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>What</th>
              <th>How often</th>
              <th className="r">Amount</th>
              <th className="r">A month</th>
              <th className="r">A year</th>
              <th className="r">Next due</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(cat => {
              const items      = expenses.filter(e => e.cat === cat)
              const catAnnuals = annualExpenses.filter(a => a.cat === cat)
              if (!items.length && !catAnnuals.length) return null

              const catMonthly = items.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)
                + catAnnuals.reduce((s, a) => s + a.amt / 12, 0)

              return [
                <tr key={`cat-${cat}`} className="cat-row">
                  <td colSpan={7}>
                    <span className="cat-row-inner">
                      <span>{cat} <span className="cat-row-total">{fmt(catMonthly)} a month</span></span>
                      {canEdit && (
                        <button type="button" className="add-btn" onClick={() => onOpen(addTarget(cat))} aria-label={`Add a ${cat} cost`}>
                          + Add a cost
                        </button>
                      )}
                    </span>
                  </td>
                </tr>,

                // Regular lines: edit in place.
                ...items.map(e => {
                  const mo = toMonthly(e.amt, e.freq)
                  return (
                    <tr key={e.id}>
                      <td>
                        <button type="button" className="del-btn" onClick={() => onDelete(e.id)} aria-label={`Remove ${e.name}`}>&#215;</button>
                      </td>
                      <td>
                        <input className="item-input" defaultValue={e.name} aria-label="What" onBlur={ev => onUpdate(e.id, 'name', ev.target.value)} />
                      </td>
                      <td>
                        <select className="freq-select" value={e.freq} aria-label="How often" onChange={ev => onUpdate(e.id, 'freq', ev.target.value)}>
                          {FREQS.map(f => <option key={f}>{f}</option>)}
                        </select>
                      </td>
                      <td className="r">
                        <input
                          className="amt-input" type="number" inputMode="decimal" step="any" aria-label="Amount"
                          key={`amt-${e.id}-${e.amt}`} defaultValue={String(e.amt)}
                          onBlur={ev => onUpdate(e.id, 'amt', parseFloat(ev.target.value) || 0)}
                        />
                      </td>
                      <td className="computed">{fmt(mo)}</td>
                      <td className="computed">{fmt(mo * 12)}</td>
                      <td className="computed" />
                    </tr>
                  )
                }),

                // Yearly bills: open in the sheet to change.
                ...catAnnuals.map(a => (
                  <tr key={`ann-${a.id}`} className="annual-row">
                    <td>
                      {canEdit && <button type="button" className="del-btn" onClick={() => void onAnnualDelete(a.id)} aria-label={`Remove ${a.name}`}>&#215;</button>}
                    </td>
                    <td>
                      <button type="button" className="row-open" disabled={!canEdit}
                        onClick={() => onOpen({ kind: 'annual', id: a.id, draft: { name: a.name, cat: a.cat, freq: 'yearly', amt: String(a.amt), month: a.month } })}>
                        {a.name}
                      </button>
                    </td>
                    <td><span className="annual-tag">yearly · {MONTH_SHORT[a.month - 1]}</span></td>
                    <td className="r computed">{fmt(a.amt)}</td>
                    <td className="computed muted">{fmt(a.amt / 12)}</td>
                    <td className="computed">{fmt(a.amt)}</td>
                    <td className="computed annual-tag">{nextExpected(a.month)}</td>
                  </tr>
                )),
              ]
            })}

            {/* Rent, when renting (its own settings) */}
            {rentMonthly !== undefined && (
              <>
                <tr className="cat-row">
                  <td colSpan={7}>
                    <span className="cat-row-inner">
                      <span>Housing <span className="cat-row-total">{fmt(rentMonthly)} a month</span></span>
                      <span className="cat-row-total">from your renting settings</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td />
                  <td><span className="item-input" style={{ display: 'inline-block', color: 'var(--t2)' }}>Rent</span></td>
                  <td><span className="annual-tag" style={{ color: 'var(--t3)' }}>monthly</span></td>
                  <td className="r">
                    <input
                      className="amt-input" type="number" inputMode="decimal" step="any" aria-label="Rent a month"
                      key={`rent-${rentMonthly}`} defaultValue={String(rentMonthly)}
                      onBlur={ev => onRentUpdate?.(parseFloat(ev.target.value) || 0)}
                    />
                  </td>
                  <td className="computed">{fmt(rentMonthly)}</td>
                  <td className="computed">{fmt(rentMonthly * 12)}</td>
                  <td className="computed" />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="exp-add-bar">
          <button type="button" className="btn btn-primary" onClick={() => onOpen(addTarget(CATS[0]))}>Add a cost</button>
          <span>Regular costs like groceries or subscriptions, or yearly bills like car rego and insurance: you choose how often, and when a yearly bill is due.</span>
        </div>
      )}
    </Panel>
  )
}
