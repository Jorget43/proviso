import { CATS, CAT_COLORS } from '@/lib/constants'
import { fmt, fmtS } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

interface MonthlySummaryProps {
  catMonthly: Record<string, number>
  monthlyIncome: number
  monthlyExpenses: number
  cashOnHand: number
}

export default function MonthlySummary({
  catMonthly,
  monthlyIncome,
  monthlyExpenses,
  cashOnHand,
}: MonthlySummaryProps) {
  const delta = monthlyIncome - monthlyExpenses
  const emergencyMonths = monthlyExpenses > 0 ? cashOnHand / monthlyExpenses : 0

  return (
    <Panel title="Monthly summary" dotColor="var(--amber)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {CATS.map((cat, i) => {
          const v = catMonthly[cat] ?? 0
          if (!v) return null
          const pct = monthlyExpenses > 0 ? (v / monthlyExpenses * 100).toFixed(1) : '0.0'
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[i], flexShrink: 0, display: 'inline-block' }} />
              <span style={{ flex: 1, color: 'var(--t2)' }}>{cat}</span>
              <span style={{ color: 'var(--t3)', fontSize: '0.66rem' }}>{pct}%</span>
              <span style={{ fontWeight: 500, minWidth: 62, textAlign: 'right' }}>{fmt(v)}</span>
            </div>
          )
        })}
      </div>
      <div style={{
        borderTop: '1px solid var(--border)',
        marginTop: 8,
        paddingTop: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontSize: '0.76rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Total out</span>
          <span style={{ fontWeight: 500, color: 'var(--red)' }}>{fmt(monthlyExpenses)}/mo</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Total in</span>
          <span style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt(monthlyIncome)}/mo</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border)',
          paddingTop: 5,
        }}>
          <span style={{ color: 'var(--t2)' }}>Delta</span>
          <span style={{ fontWeight: 500, color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {fmtS(delta)}/mo
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Emergency cover</span>
          <span style={{ fontWeight: 500 }}>{emergencyMonths.toFixed(1)} months</span>
        </div>
      </div>
    </Panel>
  )
}
