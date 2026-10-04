'use client'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

export interface MortgageSettings {
  id: number
  balance: number
  rate: number
  payment: number
  offsetBal: number
  endDate: string
}

interface MortgageDetailProps {
  mortgage: MortgageSettings
  mortgageDebtAmt: number
  onUpdate: (patch: Partial<MortgageSettings>) => void
  offsetLinked?: boolean
  offsetAccountCount?: number
}

export default function MortgageDetail({ mortgage, mortgageDebtAmt, onUpdate, offsetLinked = false, offsetAccountCount = 0 }: MortgageDetailProps) {
  const rate = mortgage.rate / 100
  const bal  = mortgageDebtAmt
  const eff  = Math.max(0, bal - mortgage.offsetBal)
  const mi   = eff * (rate / 12)
  const mp   = mortgage.payment - mi
  const ob   = mortgage.offsetBal * (rate / 12)

  const end  = new Date(mortgage.endDate)
  const now  = new Date()
  const yrs  = Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25))

  return (
    <Panel title="Mortgage detail" dotColor="var(--amber)">
      <div className="da-grid" style={{ marginBottom: '0.75rem' }}>
        <div className="da-row">
          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Interest rate</label>
          <input
            className="da-input wide"
            type="number"
            step="0.01"
            defaultValue={mortgage.rate}
            onBlur={e => onUpdate({ rate: parseFloat(e.target.value) || 0 })}
          />
          <span className="small">%</span>
        </div>
        <div className="da-row">
          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Monthly repayment</label>
          <div className="input-prefix" style={{ width: 145 }}>
            <span>$</span>
            <input
              type="number"
              defaultValue={mortgage.payment}
              onBlur={e => onUpdate({ payment: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="da-row">
          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>
            Offset balance
            {offsetLinked && (
              <span style={{ display: 'block', color: 'var(--teal)', fontSize: '0.66rem' }}>
                linked to {offsetAccountCount} offset account{offsetAccountCount === 1 ? '' : 's'}
              </span>
            )}
          </label>
          <div className="input-prefix" style={{ width: 145 }}>
            <span>$</span>
            <input
              key={offsetLinked ? `linked-${mortgage.offsetBal}` : 'manual'}
              type="number"
              defaultValue={mortgage.offsetBal}
              disabled={offsetLinked}
              title={offsetLinked ? 'Driven by the cash accounts flagged as Offset in Assets' : undefined}
              onBlur={e => onUpdate({ offsetBal: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="da-row">
          <label style={{ flex: 1, color: 'var(--t2)', fontSize: '0.74rem' }}>Mortgage end date</label>
          <input
            className="da-input"
            type="date"
            defaultValue={mortgage.endDate}
            style={{ flex: 1 }}
            onBlur={e => onUpdate({ endDate: e.target.value })}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.74rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Effective balance (after offset)</span>
          <span style={{ fontWeight: 500 }}>{fmt(eff)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Monthly interest</span>
          <span style={{ fontWeight: 500, color: 'var(--red)' }}>{fmt(mi)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Monthly principal</span>
          <span style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt(mp)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Monthly offset benefit</span>
          <span style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt(ob)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Years remaining (from today)</span>
          <span style={{ fontWeight: 500 }}>{yrs.toFixed(1)} yrs</span>
        </div>
      </div>
    </Panel>
  )
}
