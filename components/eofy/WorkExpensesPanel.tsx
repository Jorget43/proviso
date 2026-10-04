'use client'
import { useState } from 'react'

const WE_CATEGORIES = ['Travel', 'Equipment', 'Meals', 'Professional Dev', 'Communication', 'Other'] as const
type WECategory = typeof WE_CATEGORIES[number]

interface WorkExpense {
  id: number
  description: string
  amount: number
  date: string
  category: string
  financialYr: number
  source: string
  txnId: number | null
  receiptRef: string
  notes: string
}

interface ScanMatch {
  id: number
  dateStr: string
  desc: string
  amt: number
}

interface Props {
  initialExpenses: WorkExpense[]
  fyEnding: number
  fyLabel: string
}

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

const CAT_COLORS: Record<string, string> = {
  Travel: 'var(--blue)', Equipment: 'var(--amber)', Meals: 'var(--green)',
  'Professional Dev': 'var(--purple)', Communication: 'var(--teal)', Other: 'var(--t2)',
}

export default function WorkExpensesPanel({ initialExpenses, fyEnding, fyLabel }: Props) {
  const [expenses, setExpenses] = useState<WorkExpense[]>(initialExpenses)
  const [editId, setEditId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanMatch[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)

  // Form state
  const [fDesc, setFDesc] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(today())
  const [fCat, setFCat] = useState<WECategory>('Other')
  const [fReceiptRef, setFReceiptRef] = useState('')
  const [fNotes, setFNotes] = useState('')

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const byCategory = WE_CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0)

  function resetForm() {
    setFDesc(''); setFAmount(''); setFDate(today()); setFCat('Other'); setFReceiptRef(''); setFNotes('')
  }

  function startEdit(e: WorkExpense) {
    setEditId(e.id)
    setFDesc(e.description)
    setFAmount(String(e.amount))
    setFDate(e.date)
    setFCat(e.category as WECategory)
    setFReceiptRef(e.receiptRef)
    setFNotes(e.notes)
    setAdding(false)
  }

  function startAdd() {
    resetForm()
    setAdding(true)
    setEditId(null)
  }

  function cancel() {
    setAdding(false)
    setEditId(null)
    resetForm()
  }

  async function save() {
    const body = {
      description: fDesc.trim(),
      amount: parseFloat(fAmount),
      date: fDate,
      category: fCat,
      financialYr: fyEnding,
      receiptRef: fReceiptRef.trim(),
      notes: fNotes.trim(),
    }
    if (!body.description || isNaN(body.amount)) return

    if (editId !== null) {
      const res = await fetch(`/api/work-expenses/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const updated: WorkExpense = await res.json()
      setExpenses(prev => prev.map(e => e.id === editId ? updated : e))
      setEditId(null)
    } else {
      const res = await fetch('/api/work-expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, source: 'manual' }) })
      const created: WorkExpense = await res.json()
      setExpenses(prev => [created, ...prev])
      setAdding(false)
    }
    resetForm()
  }

  async function del(id: number) {
    await fetch(`/api/work-expenses/${id}`, { method: 'DELETE' })
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  async function scan() {
    setScanning(true)
    try {
      const res = await fetch(`/api/work-expenses/scan?fy=${fyEnding}`)
      const matches: ScanMatch[] = await res.json()
      setScanResults(matches)
      setSelected(new Set(matches.map(m => m.id)))
    } finally {
      setScanning(false)
    }
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function importSelected() {
    if (!scanResults) return
    setImporting(true)
    const toImport = scanResults.filter(m => selected.has(m.id))
    const created: WorkExpense[] = []
    for (const m of toImport) {
      const res = await fetch('/api/work-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: m.desc,
          amount: Math.abs(m.amt),
          date: m.dateStr,
          category: 'Other',
          financialYr: fyEnding,
          source: 'imported',
          txnId: m.id,
          receiptRef: '',
          notes: '',
        }),
      })
      created.push(await res.json())
    }
    setExpenses(prev => [...created, ...prev])
    setScanResults(null)
    setSelected(new Set())
    setImporting(false)
  }

  const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 80px', gap: '0.5rem', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }
  const hdStyle: React.CSSProperties = { ...rowStyle, fontWeight: 600, color: 'var(--t2)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)' }

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>
          {fyLabel} · <strong style={{ color: 'var(--blue)' }}>{fmt(total)}</strong> total · {expenses.length} {expenses.length === 1 ? 'item' : 'items'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={scan} disabled={scanning} style={{ background: 'var(--teal-lt)', color: 'var(--teal)', border: '1px solid var(--teal)', borderRadius: 5, padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
            {scanning ? 'Scanning…' : '⟳ Scan actuals'}
          </button>
          <button className="add-btn" onClick={startAdd} style={{ fontSize: '0.75rem' }}>+ Add</button>
        </div>
      </div>

      {/* Category breakdown pills */}
      {byCategory.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {byCategory.map(({ cat, total: catTotal }) => (
            <span key={cat} style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', color: CAT_COLORS[cat] ?? 'var(--t2)' }}>
              {cat}: {fmt(catTotal)}
            </span>
          ))}
        </div>
      )}

      {/* Scan results */}
      {scanResults !== null && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--teal)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--teal)' }}>
              {scanResults.length === 0 ? 'No unimported work expense transactions found.' : `${scanResults.length} possible work ${scanResults.length === 1 ? 'expense' : 'expenses'} found — tick to import`}
            </div>
            <button onClick={() => { setScanResults(null); setSelected(new Set()) }} style={{ fontSize: '0.7rem', color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Dismiss</button>
          </div>
          {scanResults.length > 0 && (
            <>
              {scanResults.map(m => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.77rem' }}>
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} />
                  <span style={{ flex: 1, color: 'var(--t1)' }}>{m.desc}</span>
                  <span style={{ color: 'var(--t2)', minWidth: 70, textAlign: 'right' }}>{m.dateStr}</span>
                  <span style={{ color: 'var(--blue)', minWidth: 80, textAlign: 'right', fontWeight: 600 }}>{fmt(m.amt)}</span>
                </label>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={importSelected}
                  disabled={importing || selected.size === 0}
                  style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', opacity: selected.size === 0 ? 0.5 : 1 }}
                >
                  {importing ? 'Importing…' : `Import ${selected.size} selected`}
                </button>
                <button onClick={() => setSelected(new Set(scanResults.map(m => m.id)))} style={{ fontSize: '0.73rem', color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer' }}>Select all</button>
                <button onClick={() => setSelected(new Set())} style={{ fontSize: '0.73rem', color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
              </div>
              <p style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: 8, marginBottom: 0 }}>
                Imported items default to category "Other" — edit them to set the correct category for your accountant report.
              </p>
            </>
          )}
        </div>
      )}

      {/* Add / Edit form */}
      {(adding || editId !== null) && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <input className="da-input" value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="e.g. Officeworks printer cartridges" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <div className="input-prefix" style={{ flex: 1 }}>
                <span>$</span>
                <input value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00" style={{ textAlign: 'right' }} type="number" min="0" step="0.01" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input className="da-input" type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select className="da-input" value={fCat} onChange={e => setFCat(e.target.value as WECategory)} style={{ width: '100%' }}>
                {WE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Receipt / ref (optional)</label>
              <input className="da-input" value={fReceiptRef} onChange={e => setFReceiptRef(e.target.value)} placeholder="Receipt #" style={{ width: '100%' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes (optional)</label>
              <input className="da-input" value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="e.g. used exclusively for work" style={{ width: '100%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 14px', fontSize: '0.75rem', cursor: 'pointer' }}>
              {editId !== null ? 'Save changes' : 'Add expense'}
            </button>
            <button onClick={cancel} style={{ fontSize: '0.75rem', color: 'var(--t3)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 10px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {expenses.length === 0 && !adding ? (
        <p style={{ fontSize: '0.76rem', color: 'var(--t3)', margin: '12px 0' }}>No work expenses recorded for {fyLabel}. Add one above or scan your actuals.</p>
      ) : (
        <>
          <div style={hdStyle}>
            <span>Description</span>
            <span>Category</span>
            <span style={{ textAlign: 'right' }}>Date</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span />
          </div>
          {expenses.map(e => (
            <div key={e.id} style={rowStyle}>
              <div>
                <div style={{ color: 'var(--t1)' }}>{e.description}</div>
                {e.receiptRef && <div style={{ fontSize: '0.68rem', color: 'var(--t3)' }}>Ref: {e.receiptRef}</div>}
                {e.notes && <div style={{ fontSize: '0.68rem', color: 'var(--t3)' }}>{e.notes}</div>}
                {e.source === 'imported' && <span style={{ fontSize: '0.65rem', color: 'var(--teal)', background: 'var(--teal-lt)', padding: '1px 5px', borderRadius: 3 }}>imported</span>}
              </div>
              <span style={{ fontSize: '0.7rem', color: CAT_COLORS[e.category] ?? 'var(--t2)' }}>{e.category}</span>
              <span style={{ textAlign: 'right', color: 'var(--t2)' }}>{e.date}</span>
              <span style={{ textAlign: 'right', color: 'var(--blue)', fontWeight: 600 }}>{fmt(e.amount)}</span>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button onClick={() => startEdit(e)} style={iconBtn}>✎</button>
                <button onClick={() => del(e.id)} className="del-btn">✕</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--blue)' }}>
            Total: {fmt(total)}
          </div>
        </>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.68rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }
const iconBtn: React.CSSProperties = { background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--t2)' }
