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

export interface AnnualExpense {
  id:    number
  name:  string
  cat:   string
  amt:   number
  month: number
}

const FREQS = ['weekly', 'monthly', 'quarterly', 'yearly']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const BLANK = { name: '', cat: 'Home' as string, amt: '' as string | number, month: 1 }

function nextExpected(month: number): string {
  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const year = month >= thisMonth ? now.getFullYear() : now.getFullYear() + 1
  return `${MONTH_SHORT[month - 1]} ${year}`
}

interface ExpenseTableProps {
  expenses: Expense[]
  onAdd: (cat?: string) => void
  onUpdate: (id: number, field: string, value: string | number) => void
  onDelete: (id: number) => void
  annualExpenses: AnnualExpense[]
  canEdit: boolean
  onAnnualAdd: (data: { name: string; cat: string; amt: number; month: number }) => Promise<void>
  onAnnualUpdate: (id: number, data: { name: string; cat: string; amt: number; month: number }) => Promise<void>
  onAnnualDelete: (id: number) => Promise<void>
  rentMonthly?: number
  onRentUpdate?: (monthly: number) => Promise<void>
}

export default function ExpenseTable({
  expenses, onAdd, onUpdate, onDelete,
  annualExpenses, canEdit, onAnnualAdd, onAnnualUpdate, onAnnualDelete,
  rentMonthly, onRentUpdate,
}: ExpenseTableProps) {
  const [addCat, setAddCat] = useState<string>(CATS[0])

  // Annual expense edit/add state
  const [editId, setEditId]           = useState<number | null>(null)
  const [addingCat, setAddingCat]     = useState<string | null>(null)  // which cat is open for add
  const [form, setForm]               = useState<typeof BLANK>(BLANK)
  const [annualError, setAnnualError] = useState<string | null>(null)

  function patchForm<K extends keyof typeof BLANK>(k: K, v: any) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function startEdit(item: AnnualExpense) {
    setEditId(item.id)
    setAddingCat(null)
    setForm({ name: item.name, cat: item.cat, amt: String(item.amt), month: item.month })
    setAnnualError(null)
  }

  function startAdd(cat: string) {
    setAddingCat(cat)
    setEditId(null)
    setForm({ ...BLANK, cat })
    setAnnualError(null)
  }

  function cancelAnnual() {
    setEditId(null)
    setAddingCat(null)
    setForm(BLANK)
    setAnnualError(null)
  }

  async function saveAnnual(e: React.FormEvent) {
    e.preventDefault()
    setAnnualError(null)
    const data = { name: form.name as string, cat: form.cat, amt: Number(form.amt), month: Number(form.month) }
    try {
      if (editId !== null) {
        await onAnnualUpdate(editId, data)
        setEditId(null)
      } else {
        await onAnnualAdd(data)
        setAddingCat(null)
      }
      setForm(BLANK)
    } catch {
      setAnnualError('Failed to save')
    }
  }

  async function deleteAnnual(id: number) {
    setAnnualError(null)
    try { await onAnnualDelete(id) } catch { setAnnualError('Failed to delete') }
  }

  return (
    <Panel title="Expenses" dotColor="var(--red)" rawBody>
      {annualError && (
        <div style={{ fontSize: '0.73rem', color: 'var(--red)', padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
          {annualError}
        </div>
      )}

      {/* ── Main expenses table (regular + annual, merged by category) ─────────── */}
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
              <th className="r" style={{ color: 'var(--t3)', fontWeight: 500 }}>Next expected</th>
            </tr>
          </thead>
          <tbody>
            {CATS.map(cat => {
              const items      = expenses.filter(e => e.cat === cat)
              const catAnnuals = annualExpenses.filter(a => a.cat === cat)
              if (!items.length && !catAnnuals.length && addingCat !== cat) return null

              const catMonthly = items.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)
                + catAnnuals.reduce((s, a) => s + a.amt / 12, 0)

              return [
                <tr key={`cat-${cat}`} className="cat-row">
                  <td colSpan={7}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{cat} <span>&mdash; {fmt(catMonthly)}/mo</span></span>
                      {canEdit && (
                        <span style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="add-btn"
                            style={{ fontSize: '0.68rem', padding: '1px 8px' }}
                            onClick={() => onAdd(cat)}
                            title={`Add a regular ${cat} expense`}
                          >
                            + add
                          </button>
                          <button
                            className="add-btn"
                            style={{ fontSize: '0.68rem', padding: '1px 8px', background: 'var(--teal)', opacity: editId !== null || addingCat !== null ? 0.4 : 1 }}
                            onClick={() => editId === null && addingCat === null && startAdd(cat)}
                            title={`Add a one-off annual ${cat} expense`}
                          >
                            + annual
                          </button>
                        </span>
                      )}
                    </span>
                  </td>
                </tr>,

                // Regular expense rows
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
                      <td className="computed" />
                    </tr>
                  )
                }),

                // Annual expense rows for this category
                ...catAnnuals.map(a => editId === a.id ? (
                  <tr key={`ann-edit-${a.id}`}>
                    <td colSpan={7} style={{ padding: '8px 12px' }}>
                      <AnnualForm form={form} patch={patchForm} onSubmit={saveAnnual} onCancel={cancelAnnual} />
                    </td>
                  </tr>
                ) : (
                  <tr key={`ann-${a.id}`} style={{ background: 'var(--surface2)' }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {canEdit && (
                        <>
                          <button className="del-btn" onClick={() => deleteAnnual(a.id)}>&#215;</button>
                          <button
                            className="hint-link"
                            style={{ fontSize: '0.65rem', marginLeft: 3 }}
                            onClick={() => startEdit(a)}
                          >✎</button>
                        </>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--t2)', paddingLeft: 2 }}>{a.name}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', color: 'var(--teal)', fontWeight: 500 }}>
                        yearly · {MONTH_SHORT[a.month - 1]}
                      </span>
                    </td>
                    <td className="r" style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}>{fmt(a.amt)}</td>
                    <td className="computed" style={{ color: 'var(--t3)' }}>{fmt(a.amt / 12)}</td>
                    <td className="computed">{fmt(a.amt)}</td>
                    <td className="computed" style={{ color: 'var(--teal)', fontWeight: 500 }}>{nextExpected(a.month)}</td>
                  </tr>
                )),

                // Add annual expense form (inline within this category)
                addingCat === cat && (
                  <tr key={`ann-add-${cat}`}>
                    <td colSpan={7} style={{ padding: '8px 12px', background: 'var(--surface2)' }}>
                      <AnnualForm form={form} patch={patchForm} onSubmit={saveAnnual} onCancel={cancelAnnual} />
                    </td>
                  </tr>
                ),
              ]
            })}

            {/* ── Rent row (when renter mode is enabled) ── */}
            {rentMonthly !== undefined && (
              <>
                <tr className="cat-row">
                  <td colSpan={7}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Housing &mdash; {fmt(rentMonthly)}/mo</span>
                      <span style={{ fontSize: '0.66rem', color: 'var(--t3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                        managed via rent settings
                      </span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td />
                  <td>
                    <span className="item-input" style={{ display: 'inline-block', color: 'var(--t2)' }}>Rent</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.77rem', color: 'var(--t3)' }}>monthly</span>
                  </td>
                  <td className="r">
                    <input
                      className="amt-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      key={`rent-${rentMonthly}`}
                      defaultValue={String(rentMonthly)}
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

      {/* ── Bottom add bar ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '0.6rem 1.2rem',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface2)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span className="small">Add item to</span>
        <select className="freq-select" value={addCat} onChange={e => setAddCat(e.target.value)}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="add-btn" onClick={() => onAdd(addCat)}>+ Add expense</button>
        <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
        <button
          className="add-btn"
          style={{ background: 'var(--teal)' }}
          onClick={() => editId === null && addingCat === null && startAdd(addCat)}
          disabled={editId !== null || addingCat !== null}
        >
          + Add one-off annual
        </button>
      </div>
    </Panel>
  )
}

function AnnualForm({ form, patch, onSubmit, onCancel }: {
  form: { name: string | number; cat: string; amt: string | number; month: number }
  patch: (k: any, v: any) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={lbl}>
        <span style={lspan}>Name</span>
        <input value={form.name as string} onChange={e => patch('name', e.target.value)} required placeholder="e.g. Car rego" style={inp} />
      </label>
      <label style={lbl}>
        <span style={lspan}>Category</span>
        <select value={form.cat} onChange={e => patch('cat', e.target.value)} style={sel}>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label style={lbl}>
        <span style={lspan}>Amount</span>
        <div style={{ position: 'relative' }}>
          <span className="input-prefix">$</span>
          <input type="number" min="0" step="1" value={form.amt} onChange={e => patch('amt', e.target.value)}
            required placeholder="0" style={{ ...inp, paddingLeft: 24, width: 100 }} />
        </div>
      </label>
      <label style={lbl}>
        <span style={lspan}>Month due</span>
        <select value={form.month} onChange={e => patch('month', Number(e.target.value))} style={sel}>
          {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end', paddingBottom: 1 }}>
        <button type="submit" className="add-btn">Save</button>
        <button type="button" className="hint-link" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 }
const lspan: React.CSSProperties = { fontSize: '0.68rem', color: 'var(--t3)' }
const inp: React.CSSProperties = { padding: '6px 8px', fontSize: '0.8rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--t1)', width: 160 }
const sel: React.CSSProperties = { ...inp, width: 'auto' }
