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

  // Annual expense edit state
  const [editId, setEditId]       = useState<number | null>(null)
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState<typeof BLANK>(BLANK)
  const [annualError, setAnnualError] = useState<string | null>(null)

  function patchForm<K extends keyof typeof BLANK>(k: K, v: any) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function startEdit(item: AnnualExpense) {
    setEditId(item.id)
    setAdding(false)
    setForm({ name: item.name, cat: item.cat, amt: String(item.amt), month: item.month })
    setAnnualError(null)
  }

  function cancelAnnual() {
    setEditId(null)
    setAdding(false)
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
        setAdding(false)
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

  const annualTotal = annualExpenses.reduce((s, i) => s + i.amt, 0)
  const showAnnual = annualExpenses.length > 0 || adding

  return (
    <Panel title="Expenses" dotColor="var(--red)" rawBody>
      {/* ── Regular monthly expenses ─────────────────────────────────────────── */}
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

            {/* ── Rent row (when renter mode is enabled) ── */}
            {rentMonthly !== undefined && (
              <>
                <tr className="cat-row">
                  <td colSpan={6}>
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
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Annual & irregular expenses ──────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {/* Section header */}
        <div style={{
          padding: '5px 10px 5px 8px',
          background: 'var(--surface2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: showAnnual || annualError ? '1px solid var(--border)' : undefined,
        }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--t2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Annual &amp; irregular
            <span style={{ fontWeight: 400, color: 'var(--t3)', textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
              — lump-sum costs by month
            </span>
          </span>
          {canEdit && !adding && !editId && (
            <button
              className="add-btn"
              style={{ fontSize: '0.68rem', padding: '1px 8px' }}
              onClick={() => { setAdding(true); setForm(BLANK) }}
            >
              + add
            </button>
          )}
        </div>

        {annualError && (
          <div style={{ fontSize: '0.73rem', color: 'var(--red)', padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
            {annualError}
          </div>
        )}

        {showAnnual && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  {['Name', 'Category', 'Amount', 'Month', 'Next expected', ''].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '4px 8px',
                      color: 'var(--t3)', fontWeight: 500, fontSize: '0.7rem',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {annualExpenses.map(item => editId === item.id ? (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td colSpan={6} style={{ padding: '8px 12px' }}>
                      <AnnualForm form={form} patch={patchForm} onSubmit={saveAnnual} onCancel={cancelAnnual} />
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdA}>{item.name}</td>
                    <td style={tdA}><span className={`pill pill-${item.cat.toLowerCase()}`}>{item.cat}</span></td>
                    <td style={{ ...tdA, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.amt)}</td>
                    <td style={tdA}>{MONTH_SHORT[item.month - 1]}</td>
                    <td style={{ ...tdA, color: 'var(--t3)' }}>{nextExpected(item.month)}</td>
                    <td style={{ ...tdA, whiteSpace: 'nowrap' }}>
                      {canEdit && (
                        <>
                          <button className="hint-link" style={{ fontSize: '0.7rem', marginRight: 6 }} onClick={() => startEdit(item)}>Edit</button>
                          <button className="del-btn" onClick={() => deleteAnnual(item.id)} aria-label={`Delete ${item.name}`}>&#215;</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {adding && (
                  <tr>
                    <td colSpan={6} style={{ padding: '8px 12px' }}>
                      <AnnualForm form={form} patch={patchForm} onSubmit={saveAnnual} onCancel={cancelAnnual} />
                    </td>
                  </tr>
                )}
              </tbody>
              {annualExpenses.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ padding: '6px 8px', fontSize: '0.72rem', color: 'var(--t3)' }}>Annual total</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(annualTotal)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ── Bottom add bar ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '0.6rem 1.2rem',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface2)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}>
        <span className="small">Add item to</span>
        <select className="freq-select" value={addCat} onChange={e => setAddCat(e.target.value)}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="add-btn" onClick={() => onAdd(addCat)}>+ Add expense</button>
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
          <input type="number" min="0" step="1" value={form.amt as string} onChange={e => patch('amt', e.target.value)}
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

const tdA: React.CSSProperties  = { padding: '8px 8px', verticalAlign: 'middle' }
const lbl: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 3 }
const lspan: React.CSSProperties = { fontSize: '0.68rem', color: 'var(--t3)' }
const inp: React.CSSProperties  = { padding: '6px 8px', fontSize: '0.8rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--t1)', width: 160 }
const sel: React.CSSProperties  = { ...inp, width: 'auto' }
