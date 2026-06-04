import { fmt, fmtS } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

interface NetPositionProps {
  totalDebts: number
  totalAssets: number
}

export default function NetPosition({ totalDebts, totalAssets }: NetPositionProps) {
  const net = totalAssets - totalDebts
  return (
    <Panel title="Net position" dotColor="var(--purple)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Total debts</span>
          <span style={{ color: 'var(--red)', fontWeight: 500 }}>{fmt(totalDebts)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>Total assets</span>
          <span style={{ color: 'var(--green)', fontWeight: 500 }}>{fmt(totalAssets)}</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          borderTop: '1px solid var(--border)', paddingTop: 6,
        }}>
          <span style={{ fontWeight: 500 }}>Net position</span>
          <span style={{ fontWeight: 500, color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {fmtS(net)}
          </span>
        </div>
      </div>
    </Panel>
  )
}
