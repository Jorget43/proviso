'use client'
import { useState } from 'react'
import { fmt } from '@/lib/formatting'
import type { HelpAlert } from '@/lib/help'

interface Props {
  alerts:    HelpAlert[]
  daysUntil: number
  fyEnding:  number
}

// Prominent, seasonal callout shown in the run-up to 1 June. Only the members
// with something left to index are passed in; the parent gates on the window.
export default function HelpIndexationAlert({ alerts, daysUntil, fyEnding }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || alerts.length === 0) return null

  const totalIncrease = alerts.reduce((s, a) => s + a.increase, 0)
  const totalPayment  = alerts.reduce((s, a) => s + a.suggestedPayment, 0)

  return (
    <div style={{
      position:     'relative',
      marginBottom: 20,
      padding:      '14px 16px',
      borderRadius: 'var(--rl)',
      background:   'color-mix(in srgb, var(--amber) 12%, transparent)',
      border:       '1px solid color-mix(in srgb, var(--amber) 32%, transparent)',
    }}>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          position: 'absolute', top: 8, right: 10, background: 'none', border: 'none',
          color: 'var(--t3)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 2,
        }}
      >
        ×
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--amber)' }}>
          HELP indexation in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>
          1 June {fyEnding}
        </span>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--t1)', lineHeight: 1.5, margin: '0 0 10px' }}>
        Your HELP balance will be indexed by <strong>{fmt(totalIncrease)}</strong> on 1 June.
        Paying <strong>{fmt(totalPayment)}</strong> directly to the ATO before then avoids
        the increase entirely — a guaranteed, tax-free return.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alerts.map(a => (
          <div key={a.member} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            gap: 8, fontSize: '0.74rem',
          }}>
            <span style={{ color: 'var(--t2)' }}>{a.member}</span>
            <span style={{ color: 'var(--t3)', flex: 1, textAlign: 'right' }}>
              pay {fmt(a.suggestedPayment)} → save {fmt(a.saving)}
            </span>
            <span style={{
              color: 'var(--green)', fontWeight: 600, whiteSpace: 'nowrap',
              minWidth: 132, textAlign: 'right',
            }}>
              {a.cpiRate.toFixed(1)}% = {a.preTaxEquivReturn.toFixed(1)}% pre-tax
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '0.67rem', color: 'var(--t3)', lineHeight: 1.4, margin: '10px 0 0' }}>
        At your marginal rate, a guaranteed {alerts[0].cpiRate.toFixed(1)}% tax-free saving is
        worth more than an equivalent pre-tax investment return. PAYG withheld by your employer
        is credited <em>after</em> 1 June and does not reduce what gets indexed.
      </p>
    </div>
  )
}
