import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

interface EmergencyFundProps {
  cashOnHand: number
  monthlyExpenses: number
}

export default function EmergencyFund({ cashOnHand, monthlyExpenses }: EmergencyFundProps) {
  const months = monthlyExpenses > 0 ? cashOnHand / monthlyExpenses : 0
  const status = months >= 6 ? 'green' : months >= 3 ? 'amber' : 'red'
  const label  = months >= 6 ? 'Healthy (6+ months)' : months >= 3 ? 'Adequate (3–6 months)' : 'Low (under 3 months)'

  return (
    <Panel title="Emergency fund" dotColor="var(--blue)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Cash on hand</span>
          <span style={{ fontWeight: 500 }}>{fmt(cashOnHand)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Monthly burn</span>
          <span style={{ fontWeight: 500 }}>{fmt(monthlyExpenses)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Coverage</span>
          <span style={{ fontWeight: 500 }}>{months.toFixed(1)} months</span>
        </div>
        <div>
          <span className={`pill pill-${status}`}>{label}</span>
        </div>
      </div>
    </Panel>
  )
}
