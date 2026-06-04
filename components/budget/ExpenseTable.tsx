'use client'
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
  onAdd: () => void
  onUpdate: (id: number, field: string, value: string | number) => void
  onDelete: (id: number) => void
}

const FREQS = ['weekly', 'monthly', 'quarterly', 'yearly']

export default function ExpenseTable({ expenses, onAdd, onUpdate, onDelete }: ExpenseTableProps) {
  return (
    <Panel
      title="Expenses"
      dotColor="var(--red)"
      right={<span className="small">Click any field to edit</span>}
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
                    {cat} <span>&mdash; {fmt(catTotal)}/mo</span>
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
                          defaultValue={e.amt.toFixed(2)}
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
      <div style={{ padding: '0.6rem 1.2rem', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <button className="add-btn" onClick={onAdd}>+ Add expense</button>
      </div>
    </Panel>
  )
}
