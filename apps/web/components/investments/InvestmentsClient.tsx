'use client'
import { useState, useMemo, useCallback } from 'react'
import Panel from '@/components/ui/Panel'
import ReadOnlyFence from '@/components/ui/ReadOnlyFence'
import { fmt, fmtS } from '@proviso/core/formatting'
import { computeCgt } from '@proviso/core/cgt'

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
  canEdit:          boolean
  initialParcels:   Parcel[]
  members:          string[]
  marginalByMember: Record<string, number>
}

// 30 June of the planned sale year — else today (hypothetical sale now).
function asOfDate(sellYear: number | null): Date {
  return sellYear ? new Date(sellYear, 5, 30) : new Date()
}

export default function InvestmentsClient({ canEdit, initialParcels, members, marginalByMember }: Props) {
  const [parcels, setParcels] = useState<Parcel[]>(initialParcels)
  const [sentIds, setSentIds] = useState<Record<number, boolean>>({})

  const addParcel = useCallback(async () => {
    const res = await fetch('/api/investments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member: members[0], name: 'New holding', purchaseDate: new Date().toISOString().slice(0, 10) }),
    })
    if (!res.ok) return  // failure is reported by SaveErrorToast
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

      <ReadOnlyFence canEdit={canEdit}>
      <Panel title="Investment parcels" dotColor="var(--teal)">
        <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginBottom: 14, lineHeight: 1.5 }}>
          Add each purchase separately: the tax on selling depends on how long each one was held — keep it
          12 months or more and only half the gain is taxed. Pick the year you plan to sell to see the tax then,
          and add it to Projections.
        </p>

        {parcels.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--t3)', margin: '0 0 12px' }}>
            No parcels yet. Add a holding to estimate CGT on a hypothetical sale.
          </p>
        )}

        <div className="parcels">
          {parcels.map(p => {
            const c = cgtByParcel.get(p.id)!
            return (
              <div key={p.id} className="parcel">
                <div className="parcel-head">
                  <span className="parcel-title">{p.name || 'Unnamed holding'}</span>
                  <button className="parcel-remove" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}>Remove</button>
                </div>

                {/* Editable fields — two columns on a phone, one row on desktop */}
                <div className="parcel-fields">
                  <Field label="Holding" wide>
                    <input className="parcel-input" defaultValue={p.name} onBlur={e => update(p.id, 'name', e.target.value)} />
                  </Field>
                  <Field label="Owner">
                    <select value={p.member} onChange={e => update(p.id, 'member', e.target.value)} className="parcel-input">
                      {members.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Plan to sell">
                    <select value={p.sellYear ?? ''} onChange={e => update(p.id, 'sellYear', e.target.value ? parseInt(e.target.value) : null)} className="parcel-input">
                      <option value="">Not planned</option>
                      {sellYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </Field>
                  <Field label="Quantity">
                    <input className="parcel-input" type="number" step="any" inputMode="decimal" defaultValue={p.quantity} onBlur={e => update(p.id, 'quantity', parseFloat(e.target.value) || 0)} />
                  </Field>
                  <Field label="Bought on">
                    <input className="parcel-input" type="date" defaultValue={p.purchaseDate?.slice(0, 10)} onBlur={e => update(p.id, 'purchaseDate', e.target.value)} />
                  </Field>
                  <Field label="Price paid">
                    <div className="input-prefix parcel-money"><span>$</span>
                      <input type="number" step="any" inputMode="decimal" defaultValue={p.purchasePrice} onBlur={e => update(p.id, 'purchasePrice', parseFloat(e.target.value) || 0)} /></div>
                  </Field>
                  <Field label="Price now">
                    <div className="input-prefix parcel-money"><span>$</span>
                      <input type="number" step="any" inputMode="decimal" defaultValue={p.currentPrice} onBlur={e => update(p.id, 'currentPrice', parseFloat(e.target.value) || 0)} /></div>
                  </Field>
                </div>

                {/* What a sale would mean */}
                <div className="parcel-result">
                  <Stat label="Worth now" value={fmt(c.marketValue)} />
                  <Stat label={c.isLoss ? 'Loss' : 'Gain'} value={fmtS(c.capitalGain)} color={c.capitalGain >= 0 ? 'var(--green)' : 'var(--red)'} />
                  <Stat label="Est. tax (CGT)" value={fmt(c.estimatedCgt)} color="var(--red)" />
                  <Stat label="You'd keep" value={fmt(c.netProceeds)} />
                </div>
                <div className="parcel-foot">
                  <span className={`parcel-badge ${c.discountEligible && !c.isLoss ? 'on' : ''}`}>
                    {c.isLoss ? 'No tax on a loss' : c.discountEligible ? 'Half the gain is taxed (held 12 months+)' : `Full gain taxed (held ${c.heldMonths} month${c.heldMonths === 1 ? '' : 's'})`}
                  </span>
                  {p.sellYear && !c.isLoss && c.estimatedCgt > 0 && (
                    <button className="hint-link parcel-send"
                      onClick={() => sendToProjections(p, c.estimatedCgt)} disabled={sentIds[p.id]}>
                      {sentIds[p.id] ? 'Added to Projections ✓' : `Add ${fmt(c.estimatedCgt)} tax to Projections (${p.sellYear})`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button className="add-btn mt1" onClick={addParcel} style={{ marginTop: 14 }}>+ Add parcel</button>
      </Panel>
      </ReadOnlyFence>

      <p style={{ fontSize: '0.68rem', color: 'var(--t3)', lineHeight: 1.5, marginTop: 12 }}>
        Estimates only. CGT uses the owner&apos;s marginal rate (incl. Medicare) on the discounted gain and ignores
        capital losses carried from other parcels, brokerage, and CGT events other than a straight sale. The 50%
        discount reflects current law (Jun 2026). Confirm with the ATO or your adviser before acting.
      </p>
    </div>
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`parcel-field${wide ? ' wide' : ''}`}>
      <span className="parcel-label">{label}</span>
      {children}
    </label>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span className="parcel-stat">
      <span className="parcel-label">{label}</span>
      <span className="parcel-stat-value" style={color ? { color } : undefined}>{value}</span>
    </span>
  )
}
