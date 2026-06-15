'use client'
import { useState } from 'react'

interface Donation {
  id: number
  charity: string
  abn: string
  amount: number
  date: string
  financialYr: number
  source: string
  txnId: number | null
  notes: string
}

interface ScanMatch {
  id: number
  dateStr: string
  desc: string
  amt: number
}

interface Props {
  initialDonations: Donation[]
  fyEnding: number
  fyLabel: string
}

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

export default function DonationsPanel({ initialDonations, fyEnding, fyLabel }: Props) {
  const [donations, setDonations] = useState<Donation[]>(initialDonations)
  const [editId, setEditId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanMatch[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)

  // Form state
  const [fCharity, setFCharity] = useState('')
  const [fAbn, setFAbn] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(today())
  const [fNotes, setFNotes] = useState('')

  const total = donations.reduce((s, d) => s + d.amount, 0)

  function resetForm() {
    setFCharity(''); setFAbn(''); setFAmount(''); setFDate(today()); setFNotes('')
  }

  function startEdit(d: Donation) {
    setEditId(d.id)
    setFCharity(d.charity)
    setFAbn(d.abn)
    setFAmount(String(d.amount))
    setFDate(d.date)
    setFNotes(d.notes)
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
      charity: fCharity.trim(),
      abn: fAbn.trim(),
      amount: parseFloat(fAmount),
      date: fDate,
      financialYr: fyEnding,
      notes: fNotes.trim(),
    }
    if (!body.charity || isNaN(body.amount)) return

    if (editId !== null) {
      const res = await fetch(`/api/donations/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const updated: Donation = await res.json()
      setDonations(prev => prev.map(d => d.id === editId ? updated : d))
      setEditId(null)
    } else {
      const res = await fetch('/api/donations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, source: 'manual' }) })
      const created: Donation = await res.json()
      setDonations(prev => [created, ...prev])
      setAdding(false)
    }
    resetForm()
  }

  async function del(id: number) {
    await fetch(`/api/donations/${id}`, { method: 'DELETE' })
    setDonations(prev => prev.filter(d => d.id !== id))
  }

  async function scan() {
    setScanning(true)
    try {
      const res = await fetch(`/api/donations/scan?fy=${fyEnding}`)
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
    const created: Donation[] = []
    for (const m of toImport) {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charity: m.desc,
          abn: '',
          amount: Math.abs(m.amt),
          date: m.dateStr,
          financialYr: fyEnding,
          source: 'imported',
          txnId: m.id,
          notes: '',
        }),
      })
      created.push(await res.json())
    }
    setDonations(prev => [...created, ...prev])
    setScanResults(null)
    setSelected(new Set())
    setImporting(false)
  }

  const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px', gap: '0.5rem', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }
  const hdStyle: React.CSSProperties = { ...rowStyle, fontWeight: 600, color: 'var(--t2)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)' }

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>
          {fyLabel} · <strong style={{ color: 'var(--green)' }}>{fmt(total)}</strong> total · {donations.length} {donations.length === 1 ? 'donation' : 'donations'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="add-btn" onClick={scan} disabled={scanning} style={{ background: 'var(--teal-lt)', color: 'var(--teal)', border: '1px solid var(--teal)', borderRadius: 5, padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
            {scanning ? 'Scanning…' : '⟳ Scan actuals'}
          </button>
          <button className="add-btn" onClick={startAdd} style={{ fontSize: '0.75rem' }}>+ Add</button>
        </div>
      </div>

      {/* Scan results review */}
      {scanResults !== null && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--teal)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--teal)' }}>
              {scanResults.length === 0 ? 'No unimported donation transactions found.' : `${scanResults.length} possible ${scanResults.length === 1 ? 'donation' : 'donations'} found — tick to import`}
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
                  <span style={{ color: 'var(--green)', minWidth: 80, textAlign: 'right', fontWeight: 600 }}>{fmt(m.amt)}</span>
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
                <button
                  onClick={() => setSelected(new Set(scanResults.map(m => m.id)))}
                  style={{ fontSize: '0.73rem', color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  style={{ fontSize: '0.73rem', color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add / Edit form */}
      {(adding || editId !== null) && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div>
              <label style={labelStyle}>Charity / Organisation</label>
              <input className="da-input" value={fCharity} onChange={e => setFCharity(e.target.value)} placeholder="e.g. Red Cross" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>ABN (optional)</label>
              <input className="da-input" value={fAbn} onChange={e => setFAbn(e.target.value)} placeholder="12 345 678 901" style={{ width: '100%' }} />
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
          </div>
          <div style={{ marginBottom: '0.6rem' }}>
            <label style={labelStyle}>Notes (optional)</label>
            <input className="da-input" value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="e.g. monthly direct debit" style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 14px', fontSize: '0.75rem', cursor: 'pointer' }}>
              {editId !== null ? 'Save changes' : 'Add donation'}
            </button>
            <button onClick={cancel} style={{ fontSize: '0.75rem', color: 'var(--t3)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 10px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {donations.length === 0 && !adding ? (
        <p style={{ fontSize: '0.76rem', color: 'var(--t3)', margin: '12px 0' }}>No donations recorded for {fyLabel}. Add one above or scan your actuals.</p>
      ) : (
        <>
          <div style={hdStyle}>
            <span>Charity</span>
            <span style={{ textAlign: 'right' }}>Date</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span />
          </div>
          {donations.map(d => (
            <div key={d.id} style={rowStyle}>
              <div>
                <div style={{ color: 'var(--t1)' }}>{d.charity}</div>
                {d.abn && <div style={{ fontSize: '0.68rem', color: 'var(--t3)' }}>ABN {d.abn}</div>}
                {d.notes && <div style={{ fontSize: '0.68rem', color: 'var(--t3)' }}>{d.notes}</div>}
                {d.source === 'imported' && <span style={{ fontSize: '0.65rem', color: 'var(--teal)', background: 'var(--teal-lt)', padding: '1px 5px', borderRadius: 3 }}>imported</span>}
              </div>
              <span style={{ textAlign: 'right', color: 'var(--t2)' }}>{d.date}</span>
              <span style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmt(d.amount)}</span>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button onClick={() => startEdit(d)} style={iconBtn}>✎</button>
                <button onClick={() => del(d.id)} className="del-btn">✕</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--green)' }}>
            Total: {fmt(total)}
          </div>
        </>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.68rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }
const iconBtn: React.CSSProperties = { background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--t2)' }
