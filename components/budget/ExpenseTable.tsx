'use client'
import { useState } from 'react'
import { CATS } from '@/lib/constants'
import { toMonthly, fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

export interface Expense {
  id: number
  cat: string
  name: string
  freq: string
  amt: number
}

interface ExpenseTableProps {
  expenses: Expense[]
  onAdd: (cat?: string) => void
  onUpdate: (id: number, field: string, value: string | number) => void
  onDelete: (id: number) => void
}

const FREQS = ['weekly', 'monthly', 'quarterly', 'yearly']

export default function ExpenseTable({ expenses, onAdd, onUpdate, onDelete }: ExpenseTableProps) {
  const [addCat, setAddCat] = useState<string>(CATS[0])
  return (
    <Panel
      title="Expenses"
      dotColor="var(--red)"
      rawBody
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="expense-table">
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th>Item</th>
              <th>Frequency</th>
              <th className="r">Amount</th>
              <th className="r">Monthly</th>
              <th className="r">Annual</th>
            </tr>
          </thead>
          <tbody>
            {CATS.map(cat => {
              const items = expenses.filter(e => e.cat === cat)
              if (!items.length) return null
              const catTotal = items.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)
              return [
                <tr key={`cat-${cat}`} className="cat-row">
                  <td colSpan={6}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{cat} <span>&mdash; {fmt(catTotal)}/mo</span></span>
                      <button
                        className="add-btn"
                        style={{ fontSize: '0.68rem', padding: '1px 8px' }}
                        onClick={() => onAdd(cat)}
                        title={`Add a new ${cat} item`}
                      >
                        + add
                      </button>
                    </span>
                  </td>
                </tr>,
                ...items.map(e => {
                  const mo = toMonthly(e.amt, e.freq)
                  return (
                    <tr key={e.id}>
                      <td>
                        <button className="del-btn" onClick={() => onDelete(e.id)}>&#215;</button>
                      </td>
                      <td>
                        <input
                          className="item-input"
                          defaultValue={e.name}
                          onBlur={ev => onUpdate(e.id, 'name', ev.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="freq-select"
                          value={e.freq}
                          onChange={ev => onUpdate(e.id, 'freq', ev.target.value)}
                        >
                          {FREQS.map(f => <option key={f}>{f}</option>)}
                        </select>
                      </td>
                      <td className="r">
                        <input
                          className="amt-input"
                          type="number"
                          inputMode="decimal"
                          step="any"
                          key={`amt-${e.id}-${e.amt}`}
                          defaultValue={String(e.amt)}
                          onBlur={ev => onUpdate(e.id, 'amt', parseFloat(ev.target.value) || 0)}
                        />
                      </td>
                      <td className="computed">{fmt(mo)}</td>
                      <td className="computed">{fmt(mo * 12)}</td>
                    </tr>
                  )
                }),
              ]
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '0.6rem 1.2rem', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="small">Add item to</span>
        <select className="freq-select" value={addCat} onChange={e => setAddCat(e.target.value)}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="add-btn" onClick={() => onAdd(addCat)}>+ Add expense</button>
      </div>
    </Panel>
  )
}
