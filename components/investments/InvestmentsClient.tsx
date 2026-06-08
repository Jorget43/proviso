'use client'
import { useState, useMemo, useCallback } from 'react'
import Panel from '@/components/ui/Panel'
import { fmt, fmtS } from '@/lib/formatting'
import { computeCgt } from '@/lib/cgt'

export interface Parcel {
  id:            number
  member:        string
  name:          string
  quantity:      number
  purchasePrice: number
  purchaseDate:  string
  currentPrice:  number
  sellYear:      number | null
}

interface Props {
  initialParcels:   Parcel[]
  members:          string[]
  marginalByMember: Record<string, number>
}

// 30 June of the planned sale year — else today (hypothetical sale now).
function asOfDate(sellYear: number | null): Date {
  return sellYear ? new Date(sellYear, 5, 30) : new Date()
}

export default function InvestmentsClient({ initialParcels, members, marginalByMember }: Props) {
  const [parcels, setParcels] = useState<Parcel[]>(initialParcels)
  const [sentIds, setSentIds] = useState<Record<number, boolean>>({})

  const addParcel = useCallback(async () => {
    const res = await fetch('/api/investments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member: members[0], name: 'New holding', purchaseDate: new Date().toISOString().slice(0, 10) }),
    })
    const created: Parcel = await res.json()
    setParcels(p => [...p, created])
  }, [members])

  const update = useCallback((id: number, field: keyof Parcel, value: string | number | null) => {
    setParcels(p => p.map(x => x.id === id ? { ...x, [field]: value } : x))
    fetch(`/api/investments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }, [])

  const remove = useCallback((id: number) => {
    setParcels(p => p.filter(x => x.id !== id))
    fetch(`/api/investments/${id}`, { method: 'DELETE' })
  }, [])

  const sendToProjections = useCallback(async (parcel: Parcel, cgt: number) => {
    if (!parcel.sellYear) return
    await fetch('/api/one-offs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `CGT: ${parcel.name}`, amt: Math.round(cgt), year: parcel.sellYear }),
    })
    setSentIds(s => ({ ...s, [parcel.id]: true }))
  }, [])

  const cgtByParcel = useMemo(() => {
    const map = new Map<number, ReturnType<typeof computeCgt>>()
    for (const p of parcels) {
      map.set(p.id, computeCgt({
        quantity:      p.quantity,
        purchasePrice: p.purchasePrice,
        currentPrice:  p.currentPrice,
        purchaseDate:  p.purchaseDate,
        marginalRate:  marginalByMember[p.member] ?? 0,
        asOf:          asOfDate(p.sellYear),
      }))
    }
    return map
  }, [parcels, marginalByMember])

  const totals = useMemo(() => {
    let costBase = 0, marketValue = 0, gain = 0, cgt = 0
    for (const p of parcels) {
      const c = cgtByParcel.get(p.id)!
      costBase += c.costBase; marketValue += c.marketValue; gain += c.capitalGain; cgt += c.estimatedCgt
    }
    return { costBase, marketValue, gain, cgt, net: marketValue - cgt }
  }, [parcels, cgtByParcel])

  const sellYears = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 21 }, (_, i) => y + i)
  }, [])

  return (
    <div className="page">
      {/* Portfolio summary */}
      <div className="banner" style={{ marginBottom: '1rem' }}>
        <div className="b-item"><span className="b-label">Cost base</span><span className="b-value">{fmt(totals.costBase)}</span></div>
        <div className="b-item"><span className="b-label">Market value</span><span className="b-value">{fmt(totals.marketValue)}</span></div>
        <div className="b-item"><span className="b-label">Unrealised gain</span><span className={`b-value ${totals.gain >= 0 ? 'green' : 'red'}`}>{fmtS(totals.gain)}</span></div>
        <div className="b-item"><span className="b-label">Est. CGT</span><span className="b-value red">{fmt(totals.cgt)}</span></div>
        <div className="b-item"><span className="b-label">Net after CGT</span><span className="b-value">{fmt(totals.net)}</span></div>
      </div>

      <Panel title="Investment parcels" dotColor="var(--teal)">
        <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginBottom: 14, lineHeight: 1.5 }}>
          Each purchase is a separate parcel — the 50% CGT discount applies per parcel once held 12+ months.
          Set a planned sale year to test the gain against a future holding period and push the estimated CGT
          into Projections as a one-off.
        </p>

        {parcels.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--t3)', margin: '0 0 12px' }}>
            No parcels yet. Add a holding to estimate CGT on a hypothetical sale.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {parcels.map(p => {
            const c = cgtByParcel.get(p.id)!
            return (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 12 }}>
                {/* Editable fields */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                  <Field label="Holding" width={150}>
                    <input className="da-input name" defaultValue={p.name} onBlur={e => update(p.id, 'name', e.target.value)} style={{ width: '100%' }} />
                  </Field>
                  <Field label="Owner" width={120}>
                    <select value={p.member} onChange={e => update(p.id, 'member', e.target.value)} className="nav-select" style={{ width: '100%' }}>
                      {members.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Quantity" width={90}>
                    <input type="number" step="any" defaultValue={p.quantity} onBlur={e => update(p.id, 'quantity', parseFloat(e.target.value) || 0)} style={fieldInput} />
                  </Field>
                  <Field label="Buy price" width={100}>
                    <div className="input-prefix" style={{ width: '100%' }}><span>$</span>
                      <input type="number" step="any" defaultValue={p.purchasePrice} onBlur={e => update(p.id, 'purchasePrice', parseFloat(e.target.value) || 0)} style={{ textAlign: 'right', width: '100%' }} /></div>
                  </Field>
                  <Field label="Buy date" width={130}>
                    <input type="date" defaultValue={p.purchaseDate?.slice(0, 10)} onBlur={e => update(p.id, 'purchaseDate', e.target.value)} style={fieldInput} />
                  </Field>
                  <Field label="Now price" width={100}>
                    <div className="input-prefix" style={{ width: '100%' }}><span>$</span>
                      <input type="number" step="any" defaultValue={p.currentPrice} onBlur={e => update(p.id, 'currentPrice', parseFloat(e.target.value) || 0)} style={{ textAlign: 'right', width: '100%' }} /></div>
                  </Field>
                  <Field label="Plan to sell" width={110}>
                    <select value={p.sellYear ?? ''} onChange={e => update(p.id, 'sellYear', e.target.value ? parseInt(e.target.value) : null)} className="nav-select" style={{ width: '100%' }}>
                      <option value="">—</option>
                      {sellYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </Field>
                  <button className="del-btn" onClick={() => remove(p.id)} style={{ marginBottom: 2 }}>&#215;</button>
                </div>

                {/* CGT outcome */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', fontSize: '0.74rem' }}>
                  <Stat label="Market value" value={fmt(c.marketValue)} />
                  <Stat label={c.isLoss ? 'Capital loss' : 'Capital gain'} value={fmtS(c.capitalGain)} color={c.capitalGain >= 0 ? 'var(--green)' : 'var(--red)'} />
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4,
                    background: c.discountEligible ? 'var(--green-lt)' : 'var(--surface2)',
                    color: c.discountEligible ? 'var(--green)' : 'var(--t3)' }}>
                    {c.isLoss ? 'No CGT on a loss' : c.discountEligible ? '50% discount (held 12mo+)' : `No discount (held ${c.heldMonths}mo)`}
                  </span>
                  <Stat label="Est. CGT" value={fmt(c.estimatedCgt)} color="var(--red)" />
                  <Stat label="Net proceeds" value={fmt(c.netProceeds)} />
                  {p.sellYear && !c.isLoss && c.estimatedCgt > 0 && (
                    <button className="hint-link" style={{ fontSize: '0.72rem', marginLeft: 'auto' }}
                      onClick={() => sendToProjections(p, c.estimatedCgt)} disabled={sentIds[p.id]}>
                      {sentIds[p.id] ? 'Added to Projections ✓' : `Send ${fmt(c.estimatedCgt)} to Projections (${p.sellYear})`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button className="add-btn mt1" onClick={addParcel} style={{ marginTop: 14 }}>+ Add parcel</button>
      </Panel>

      <p style={{ fontSize: '0.68rem', color: 'var(--t3)', lineHeight: 1.5, marginTop: 12 }}>
        Estimates only. CGT uses the owner&apos;s marginal rate (incl. Medicare) on the discounted gain and ignores
        capital losses carried from other parcels, brokerage, and CGT events other than a straight sale. The 50%
        discount reflects current law (Jun 2026). Confirm with the ATO or your adviser before acting.
      </p>
    </div>
  )
}

const fieldInput: React.CSSProperties = { width: '100%', textAlign: 'left' }

function Field({ label, width, children }: { label: string; width: number; children: React.ReactNode }) {
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)' }}>{label}</span>
      {children}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t3)' }}>{label}</span>
      <span style={{ fontWeight: 500, color: color ?? 'var(--t1)' }}>{value}</span>
    </span>
  )
}
