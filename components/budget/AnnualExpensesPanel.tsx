'use client'
import { useState } from 'react'
import { fmt } from '@/lib/formatting'
import { CATS } from '@/lib/constants'
import Panel from '@/components/ui/Panel'

export interface AnnualExpense {
  id:    number
  name:  string
  cat:   string
  amt:   number
  month: number
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function nextExpected(month: number): string {
  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const year = month >= thisMonth ? now.getFullYear() : now.getFullYear() + 1
  return `${MONTH_SHORT[month - 1]} ${year}`
}

interface Props {
  initialItems: AnnualExpense[]
  canEdit: boolean
}

const BLANK = { name: '', cat: 'Home', amt: '', month: 1 }

export default function AnnualExpensesPanel({ initialItems, canEdit }: Props) {
  const [items, setItems]   = useState<AnnualExpense[]>(initialItems)
  const [editId, setEditId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState<{ name: string; cat: string; amt: string; month: number }>(BLANK)
  const [error, setError]   = useState<string | null>(null)

  function patch<K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const body = { name: form.name, cat: form.cat, amt: Number(form.amt), month: Number(form.month) }

    if (editId !== null) {
      const res = await fetch(`/api/annual-expenses/${editId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { setError((await res.json()).error ?? 'Failed to save'); return }
      const updated = await res.json()
      setItems(prev => prev.map(i => i.id === editId ? updated : i))
      setEditId(null)
    } else {
      const res = await fetch('/api/annual-expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { setError((await res.json()).error ?? 'Failed to save'); return }
      const created = await res.json()
      setItems(prev => [...prev, created].sort((a, b) => a.month - b.month))
      setAdding(false)
    }
    setForm(BLANK)
  }

  async function remove(id: number) {
    setError(null)
    const res = await fetch(`/api/annual-expenses/${id}`, { method: 'DELETE' })
    if (!res.ok) { setError('Failed to delete'); return }
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function startEdit(item: AnnualExpense) {
    setEditId(item.id)
    setAdding(false)
    setForm({ name: item.name, cat: item.cat, amt: String(item.amt), month: item.month })
    setError(null)
  }

  function cancel() {
    setEditId(null)
    setAdding(false)
    setForm(BLANK)
    setError(null)
  }

  const annualTotal = items.reduce((s, i) => s + i.amt, 0)

  return (
    <Panel title="Annual & irregular expenses" dotColor="var(--teal)">
      <p style={{ fontSize: '0.74rem', color: 'var(--t3)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Lump-sum costs that hit in a specific month. Add them here — not to the monthly budget above — to avoid double-counting. These appear as cash-flow hits in the Cashflow tab.
      </p>

      {error && (
        <div style={{ fontSize: '0.74rem', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 5, padding: '6px 9px', marginBottom: 10 }}>
          {error}
        </div>
      )}

      {/* Table */}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name','Category','Amount','Month','Next expected',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--t3)', fontWeight: 500, fontSize: '0.7rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => editId === item.id ? (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td colSpan={6} style={{ padding: '8px' }}>
                    <InlineForm form={form} patch={patch} onSubmit={save} onCancel={cancel} />
                  </td>
                </tr>
              ) : (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}>{item.name}</td>
                  <td style={td}><span className={`pill pill-${item.cat.toLowerCase()}`}>{item.cat}</span></td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.amt)}</td>
                  <td style={td}>{MONTH_SHORT[item.month - 1]}</td>
                  <td style={{ ...td, color: 'var(--t3)' }}>{nextExpected(item.month)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {canEdit && (
                      <>
                        <button className="hint-link" style={{ fontSize: '0.7rem', marginRight: 6 }} onClick={() => startEdit(item)}>Edit</button>
                        <button className="del-btn" onClick={() => remove(item.id)} aria-label={`Delete ${item.name}`}>&#215;</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ padding: '6px 8px', fontSize: '0.72rem', color: 'var(--t3)' }}>Annual total</td>
                <td style={{ padding: '6px 8px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(annualTotal)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add form */}
      {canEdit && (
        adding ? (
          <InlineForm form={form} patch={patch} onSubmit={save} onCancel={cancel} />
        ) : (
          !editId && (
            <button className="add-btn" onClick={() => { setAdding(true); setForm(BLANK) }}>
              + Add annual expense
            </button>
          )
        )
      )}
    </Panel>
  )
}

function InlineForm({ form, patch, onSubmit, onCancel }: {
  form: { name: string; cat: string; amt: string; month: number }
  patch: <K extends 'name' | 'cat' | 'amt' | 'month'>(k: K, v: any) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={lbl}>
        <span style={lspan}>Name</span>
        <input value={form.name} onChange={e => patch('name', e.target.value)} required placeholder="e.g. Car rego" style={inp} />
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
        <span style={lspan}>Month</span>
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

const td: React.CSSProperties = { padding: '8px 8px', verticalAlign: 'middle' }
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 }
const lspan: React.CSSProperties = { fontSize: '0.68rem', color: 'var(--t3)' }
const inp: React.CSSProperties = { padding: '6px 8px', fontSize: '0.8rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--t1)', width: 160 }
const sel: React.CSSProperties = { ...inp, width: 'auto' }
