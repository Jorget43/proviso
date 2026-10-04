'use client'
import { useState } from 'react'
import { fmtK } from '@/lib/formatting'

export interface NetWorthSnapshotRow {
  id:       number
  takenAt:  string
  netWorth: number
  source:   string
}

interface NetWorthHistoryPanelProps {
  snapshots: NetWorthSnapshotRow[]
  onAdd:     (takenAt: string, netWorth: number) => void
  onDelete:  (id: number) => void
}

export default function NetWorthHistoryPanel({ snapshots, onAdd, onDelete }: NetWorthHistoryPanelProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [amt,  setAmt]  = useState('')

  const sorted = [...snapshots].sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())

  const submit = () => {
    const value = parseFloat(amt)
    if (!date || Number.isNaN(value)) return
    onAdd(date, value)
    setAmt('')
  }

  return (
    <>
      <p style={{ fontSize: '0.72rem', color: 'var(--t3)', margin: '0 0 8px', lineHeight: 1.4 }}>
        Auto-captured monthly from your Debts &amp; Assets — add past points below to backfill history sooner.
      </p>
      <div className="da-grid">
        {sorted.map(s => (
          <div key={s.id} className="da-row">
            <span style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>{new Date(s.takenAt).toLocaleDateString('en-AU')}</span>
            {s.source === 'manual' && (
              <span style={{ fontSize: '0.65rem', color: 'var(--amber)', background: 'var(--amber-lt)', padding: '1px 5px', borderRadius: 3, marginRight: 6 }}>manual</span>
            )}
            <span style={{ fontWeight: 500, fontSize: '0.78rem', minWidth: 70, textAlign: 'right' }}>{fmtK(s.netWorth)}</span>
            <button className="del-btn" onClick={() => onDelete(s.id)}>×</button>
          </div>
        ))}
        {sorted.length === 0 && (
          <p style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>No snapshots yet — the first auto-capture lands within a month, or add one manually below.</p>
        )}
      </div>
      <div className="da-row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <input
          type="date" className="da-input narrow"
          value={date} onChange={e => setDate(e.target.value)}
        />
        <div className="input-prefix" style={{ flex: 1 }}>
          <span>$</span>
          <input
            type="number" placeholder="Net worth"
            value={amt} onChange={e => setAmt(e.target.value)}
            style={{ textAlign: 'right' }}
          />
        </div>
        <button className="add-btn" onClick={submit}>+ Add</button>
      </div>
    </>
  )
}
