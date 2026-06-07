'use client'
import { useState } from 'react'
import Panel from '@/components/ui/Panel'
import { fmt } from '@/lib/formatting'

export interface HelpDetail {
  id:                  number
  member:              string
  financialYearEnding: number
  openingFyBalance:    number
  estimatedWithheld:   number
  voluntaryRepayments: number
  cpiRate:             number
}

interface MemberRow {
  name:   string
  detail: HelpDetail | null
}

interface HelpPanelProps {
  members:  MemberRow[]
  fyEnding: number
}

export default function HelpPanel({ members, fyEnding }: HelpPanelProps) {
  const fyStart        = fyEnding - 1
  const indexationDate = new Date(`${fyEnding}-06-01`)
  const postIndexation = new Date() >= indexationDate

  const [details, setDetails] = useState<Record<string, HelpDetail | null>>(
    Object.fromEntries(members.map(m => [m.name, m.detail]))
  )
  const [cpiRate, setCpiRate] = useState(
    members.find(m => m.detail)?.detail?.cpiRate ?? 3.5
  )

  const save = async (member: string, patch: Partial<HelpDetail>) => {
    const prev = details[member]
    const body = {
      member,
      financialYearEnding: fyEnding,
      openingFyBalance:    patch.openingFyBalance    ?? prev?.openingFyBalance    ?? 0,
      estimatedWithheld:   patch.estimatedWithheld   ?? prev?.estimatedWithheld   ?? 0,
      voluntaryRepayments: patch.voluntaryRepayments ?? prev?.voluntaryRepayments ?? 0,
      cpiRate,
    }
    const res    = await fetch('/api/help-debt-detail', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const saved: HelpDetail = await res.json()
    setDetails(d => ({ ...d, [member]: saved }))
  }

  const saveCpiRate = async (rate: number) => {
    setCpiRate(rate)
    for (const { name } of members) {
      const d = details[name]
      if (d) await save(name, { cpiRate: rate })
    }
  }

  return (
    <Panel
      title="HELP Indexation"
      dotColor="var(--amber)"
      right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--t2)' }}>
          <span>CPI</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={cpiRate}
            onChange={e => setCpiRate(parseFloat(e.target.value) || 0)}
            onBlur={e => saveCpiRate(parseFloat(e.target.value) || 0)}
            style={{ width: 44, textAlign: 'right', fontSize: '0.75rem', padding: '2px 4px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--t1)' }}
          />
          <span>%</span>
        </div>
      }
    >
      {/* FY + indexation status */}
      <div style={{ fontSize: '0.72rem', color: 'var(--t3)', marginBottom: 8 }}>
        FY {fyStart}–{String(fyEnding).slice(2)}
      </div>
      <div style={{
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: '0.73rem',
        marginBottom: 16,
        background:   postIndexation ? 'var(--surface2)' : 'color-mix(in srgb, var(--amber) 10%, transparent)',
        color:        postIndexation ? 'var(--t2)'        : 'var(--amber)',
        border:       postIndexation ? '1px solid var(--border)' : '1px solid color-mix(in srgb, var(--amber) 28%, transparent)',
      }}>
        {postIndexation
          ? `Indexation was applied June 1, ${fyEnding}`
          : `Indexation applies June 1, ${fyEnding} — voluntary payments before then reduce your indexable balance`}
      </div>

      {/* Per-member sections */}
      {members.map(({ name }) => {
        const d           = details[name]
        const opening     = d?.openingFyBalance    ?? 0
        const withheld    = d?.estimatedWithheld   ?? 0
        const voluntary   = d?.voluntaryRepayments ?? 0
        const indexBase   = Math.max(0, opening - voluntary)
        const increase    = indexBase * (cpiRate / 100)
        const savePer10k  = 10_000 * (cpiRate / 100)

        return (
          <div key={name} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--t1)', marginBottom: 10 }}>{name}</div>

            <HelpRow
              label="Opening balance (1 Jul)"
              hint="Balance at start of FY — this is the ATO's indexation base"
              value={opening}
              onSave={v => save(name, { openingFyBalance: v })}
            />
            <HelpRow
              label="PAYG withheld YTD"
              hint="Withheld by employer — does NOT reduce your indexable amount"
              value={withheld}
              onSave={v => save(name, { estimatedWithheld: v })}
            />
            <HelpRow
              label="Voluntary payments"
              hint="Direct payments to ATO — these DO reduce indexation"
              value={voluntary}
              onSave={v => save(name, { voluntaryRepayments: v })}
            />

            {opening > 0 && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <CalcRow label="Indexable base"              value={indexBase} />
                <CalcRow label={`June 1 increase (+${cpiRate}%)`} value={increase}  color="var(--red)" />
                {!postIndexation && (
                  <div style={{
                    marginTop: 8,
                    padding: '7px 9px',
                    background: 'color-mix(in srgb, var(--green) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)',
                    borderRadius: 5,
                    color: 'var(--green)',
                    fontSize: '0.71rem',
                    lineHeight: 1.4,
                  }}>
                    Every $10k paid to the ATO before June 1 saves {fmt(savePer10k)} in indexed debt — a guaranteed {cpiRate}% tax-free return
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div style={{ fontSize: '0.68rem', color: 'var(--t3)', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        PAYG withheld by your employer is credited to your debt <em>after</em> the June 1 indexation date — it does not reduce what gets indexed. Only voluntary payments directly to the ATO before June 1 reduce your indexable balance.
      </div>
    </Panel>
  )
}

function HelpRow({ label, hint, value, onSave }: { label: string; hint: string; value: number; onSave: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.73rem', color: 'var(--t2)' }}>{label}</div>
        <div style={{ fontSize: '0.67rem', color: 'var(--t3)', lineHeight: 1.3 }}>{hint}</div>
      </div>
      <div className="input-prefix" style={{ width: 128, flexShrink: 0 }}>
        <span>$</span>
        <input
          type="number"
          min="0"
          step="any"
          defaultValue={value}
          onBlur={e => onSave(parseFloat(e.target.value) || 0)}
          style={{ textAlign: 'right' }}
        />
      </div>
    </div>
  )
}

function CalcRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
      <span style={{ color: 'var(--t2)' }}>{label}</span>
      <span style={{ color: color ?? 'var(--t1)', fontWeight: 500 }}>{fmt(value)}</span>
    </div>
  )
}
