'use client'
import { useState } from 'react'
import Panel from '@/components/ui/Panel'
import { fmt } from '@/lib/formatting'
import {
  computeCarryForward,
  legislativeCap,
  currentFinancialYearEnding,
  CARRY_FORWARD_YEARS,
  CARRY_FORWARD_TSB_LIMIT,
  type SuperHistoryRow,
} from '@/lib/superHistory'

export interface SuperHistoryItem extends SuperHistoryRow {
  id: number
}

interface Props {
  members:     string[]
  initialRows: SuperHistoryItem[]
}

export default function ConcessionalCarryForward({ members, initialRows }: Props) {
  const [rowsByMember, setRowsByMember] = useState<Record<string, SuperHistoryItem[]>>(() => {
    const grouped: Record<string, SuperHistoryItem[]> = Object.fromEntries(members.map(m => [m, []]))
    for (const r of initialRows) (grouped[r.member] ??= []).push(r)
    return grouped
  })

  const currentFy = currentFinancialYearEnding()

  const upsert = async (member: string, body: SuperHistoryRow) => {
    const res = await fetch('/api/super-history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await res.json()) as SuperHistoryItem
  }

  const addYear = async (member: string) => {
    const existing = rowsByMember[member] ?? []
    const present = new Set(existing.map(r => r.financialYearEnding))
    // Fill the most recent missing year within the 5-year window first.
    let fy: number | null = null
    for (let y = currentFy - 1; y >= currentFy - CARRY_FORWARD_YEARS; y--) {
      if (!present.has(y)) { fy = y; break }
    }
    if (fy === null) return // window full

    const saved = await upsert(member, {
      member,
      financialYearEnding:  fy,
      concessionalCap:      legislativeCap(fy),
      concessionalUtilised: 0,
      totalSuperBalance:    0,
    })
    setRowsByMember(s => ({
      ...s,
      [member]: [...(s[member] ?? []), saved].sort((a, b) => b.financialYearEnding - a.financialYearEnding),
    }))
  }

  const updateRow = (member: string, id: number, field: keyof SuperHistoryRow, value: number) => {
    setRowsByMember(s => {
      const next = (s[member] ?? []).map(r => r.id === id ? { ...r, [field]: value } : r)
      const row = next.find(r => r.id === id)
      if (row) {
        upsert(member, {
          member,
          financialYearEnding:  row.financialYearEnding,
          concessionalCap:      row.concessionalCap,
          concessionalUtilised: row.concessionalUtilised,
          totalSuperBalance:    row.totalSuperBalance,
        })
      }
      return { ...s, [member]: next }
    })
  }

  const deleteRow = async (member: string, id: number) => {
    setRowsByMember(s => ({ ...s, [member]: (s[member] ?? []).filter(r => r.id !== id) }))
    await fetch(`/api/super-history/${id}`, { method: 'DELETE' })
  }

  return (
    <Panel title="Concessional cap carry-forward" dotColor="var(--purple)">
      <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginBottom: 14, lineHeight: 1.5 }}>
        Unused concessional cap from the last {CARRY_FORWARD_YEARS} years can be carried forward —
        but only usable in a year where your total super balance at the prior 30 June was under{' '}
        {fmt(CARRY_FORWARD_TSB_LIMIT)}. Enter each year&apos;s cap, what you actually contributed
        (employer SG + salary sacrifice + personal deductible), and your 30 June balance.
      </p>

      {members.map((member, i) => {
        const rows = rowsByMember[member] ?? []
        const cf   = computeCarryForward(member, rows)
        const windowFull = rows.filter(r =>
          r.financialYearEnding >= currentFy - CARRY_FORWARD_YEARS && r.financialYearEnding < currentFy
        ).length >= CARRY_FORWARD_YEARS

        return (
          <div key={member} style={{ marginBottom: i < members.length - 1 ? 24 : 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>{member}</div>

            {/* Carry-forward outcome */}
            <CarryForwardCallout cf={cf} hasRows={rows.length > 0} />

            {/* History rows */}
            {rows.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['FY', 'Cap', 'Contributed', 'Unused', '30 Jun balance', ''].map((h, idx) => (
                        <th key={h} style={{ textAlign: idx === 0 ? 'left' : idx === 5 ? 'center' : 'right', padding: '3px 6px', color: 'var(--t3)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const unused = Math.max(0, r.concessionalCap - r.concessionalUtilised)
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '4px 6px', color: 'var(--t2)' }}>
                            {r.financialYearEnding - 1}–{String(r.financialYearEnding).slice(2)}
                          </td>
                          <td style={{ padding: '4px 6px' }}><NumCell value={r.concessionalCap}      onSave={v => updateRow(member, r.id, 'concessionalCap', v)} /></td>
                          <td style={{ padding: '4px 6px' }}><NumCell value={r.concessionalUtilised} onSave={v => updateRow(member, r.id, 'concessionalUtilised', v)} /></td>
                          <td style={{ textAlign: 'right', padding: '4px 6px', color: unused > 0 ? 'var(--green)' : 'var(--t3)', fontWeight: 500 }}>{fmt(unused)}</td>
                          <td style={{ padding: '4px 6px' }}><NumCell value={r.totalSuperBalance}    onSave={v => updateRow(member, r.id, 'totalSuperBalance', v)} /></td>
                          <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                            <button onClick={() => deleteRow(member, r.id)} aria-label="Remove year"
                              style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }}>×</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <button className="hint-link" style={{ marginTop: 8, fontSize: '0.72rem' }}
              onClick={() => addYear(member)} disabled={windowFull}>
              {windowFull ? 'All 5 years entered' : '+ Add year'}
            </button>
          </div>
        )
      })}
    </Panel>
  )
}

function CarryForwardCallout({ cf, hasRows }: { cf: ReturnType<typeof computeCarryForward>; hasRows: boolean }) {
  if (!hasRows) {
    return (
      <div style={callout('var(--t3)', false)}>
        Add your prior-year records to see how much unused cap you can carry forward.
      </div>
    )
  }

  if (cf.availableCarryForward <= 0) {
    return (
      <div style={callout('var(--t2)', false)}>
        No unused concessional cap to carry forward from the last {CARRY_FORWARD_YEARS} years.
      </div>
    )
  }

  if (!cf.eligible) {
    const reason = cf.priorTotalSuperBalance === null
      ? `Add your FY${cf.currentFyEnding - 2}–${String(cf.currentFyEnding - 1).slice(2)} balance to confirm eligibility.`
      : `Your 30 June ${cf.currentFyEnding - 1} balance of ${fmt(cf.priorTotalSuperBalance)} is at or above the ${fmt(CARRY_FORWARD_TSB_LIMIT)} threshold, so carry-forward is unavailable this year.`
    return (
      <div style={callout('var(--amber)', true)}>
        <strong>{fmt(cf.availableCarryForward)}</strong> of unused cap has accrued, but it can&apos;t be
        used this year. {reason}
      </div>
    )
  }

  return (
    <div style={callout('var(--green)', true)}>
      You have <strong>{fmt(cf.availableCarryForward)}</strong> of unused concessional cap available to
      catch up before 30 June {cf.currentFyEnding}. Combined with this year&apos;s {fmt(cf.currentCap)} cap,
      you could contribute up to <strong>{fmt(cf.maxConcessionalThisYear)}</strong> concessionally.
    </div>
  )
}

function callout(color: string, tinted: boolean): React.CSSProperties {
  return {
    padding: '8px 11px',
    borderRadius: 6,
    fontSize: '0.74rem',
    lineHeight: 1.45,
    color,
    background: tinted ? `color-mix(in srgb, ${color} 10%, transparent)` : 'var(--surface2)',
    border: tinted ? `1px solid color-mix(in srgb, ${color} 26%, transparent)` : '1px solid var(--border)',
  }
}

function NumCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  return (
    <div className="input-prefix" style={{ width: 104, marginLeft: 'auto' }}>
      <span>$</span>
      <input type="number" min="0" step="any" defaultValue={value}
        onBlur={e => onSave(parseFloat(e.target.value) || 0)}
        style={{ textAlign: 'right', width: '100%' }} />
    </div>
  )
}
