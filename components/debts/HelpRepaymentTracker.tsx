'use client'
import { useMemo, useState } from 'react'
import { calcHELPRepayment } from '@/lib/tax'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

export interface HelpPerson {
  name:        string
  income:      number
  growthRate:  number
  helpBalance: number
}

interface Props {
  persons: HelpPerson[]
}

interface RepayRow {
  year:      number
  gross:     number
  repayment: number
  balance:   number
}

function buildSchedule(income: number, growthRate: number, helpBalance: number): RepayRow[] {
  if (helpBalance <= 0 || income <= 0) return []
  const rows: RepayRow[] = []
  let bal = helpBalance
  const cy  = new Date().getFullYear()
  const gR  = growthRate / 100
  for (let i = 0; i < 30 && bal > 0; i++) {
    const yr    = cy + i + 1
    const gross = income * Math.pow(1 + gR, i + 1)
    const repay = Math.min(bal, calcHELPRepayment(gross))
    bal = Math.max(0, bal - repay)
    rows.push({ year: yr, gross: Math.round(gross), repayment: Math.round(repay), balance: Math.round(bal) })
    if (bal === 0) break
  }
  return rows
}

export default function HelpRepaymentTracker({ persons }: Props) {
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null)

  const schedules = useMemo(
    () => persons.map(p => ({ ...p, rows: buildSchedule(p.income, p.growthRate, p.helpBalance) })),
    [persons]
  )

  if (schedules.every(s => s.rows.length === 0)) return null

  return (
    <Panel title="HELP repayment projection" dotColor="var(--teal)">
      <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginBottom: 12 }}>
        Projected year-by-year PAYG repayments based on current income and growth rate. Does not account for CPI indexation or voluntary payments.
      </p>
      {schedules.map(({ name, rows, helpBalance }) => {
        if (rows.length === 0) return null
        const clearYear   = rows.at(-1)?.balance === 0 ? rows.at(-1)?.year : null
        const isExpanded  = expandedPerson === name
        const previewRows = isExpanded ? rows : rows.slice(0, 5)

        return (
          <div key={name} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--t3)', marginLeft: 8 }}>
                  {fmt(helpBalance)} outstanding
                </span>
              </div>
              {clearYear && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 500, padding: '2px 8px',
                  borderRadius: 4, background: 'var(--green-lt)', color: 'var(--green)',
                }}>
                  Cleared {clearYear}
                </span>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Year', 'Gross income', 'Repayment', 'Balance'].map(h => (
                      <th key={h} style={{ textAlign: 'right', padding: '3px 6px', color: 'var(--t3)', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(r => (
                    <tr key={r.year} style={{ borderBottom: '1px solid var(--border)', opacity: r.balance === 0 ? 0.6 : 1 }}>
                      <td style={{ padding: '4px 6px', color: 'var(--t2)' }}>{r.year}</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px' }}>{fmt(r.gross)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--red)' }}>−{fmt(r.repayment)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', fontWeight: r.balance === 0 ? 600 : 400, color: r.balance === 0 ? 'var(--green)' : 'var(--t1)' }}>
                        {r.balance === 0 ? '✓ Cleared' : fmt(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 5 && (
              <button
                className="hint-link"
                style={{ marginTop: 6, fontSize: '0.72rem' }}
                onClick={() => setExpandedPerson(isExpanded ? null : name)}
              >
                {isExpanded ? '↑ Show less' : `↓ Show all ${rows.length} years`}
              </button>
            )}
          </div>
        )
      })}
    </Panel>
  )
}
