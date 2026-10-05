import { fmt, fmtS } from '@/lib/formatting'
import { netPositionOf } from '@/lib/netWorth'
import Panel from '@/components/ui/Panel'

interface NetPositionProps {
  debts:  { name: string; amt: number }[]
  assets: { name: string; amt: number }[]
}

// Same definition as Home and Projections (lib/netWorth.ts).
export default function NetPosition({ debts, assets }: NetPositionProps) {
  const { totalAssets, debtsOwed, netWorth, mortgageExcluded } = netPositionOf(debts, assets)
  return (
    <Panel title="Net worth" dotColor="var(--purple)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>What you own</span>
          <span style={{ color: 'var(--green)', fontWeight: 500 }}>{fmt(totalAssets)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--t2)' }}>What you owe</span>
          <span style={{ color: 'var(--red)', fontWeight: 500 }}>{fmt(debtsOwed)}</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          borderTop: '1px solid var(--border)', paddingTop: 6,
        }}>
          <span style={{ fontWeight: 500 }}>Net worth</span>
          <span style={{ fontWeight: 500, color: netWorth >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {fmtS(netWorth)}
          </span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--t3)', lineHeight: 1.45, marginTop: 4 }}>
          {mortgageExcluded > 0
            ? `Your home loan (${fmt(mortgageExcluded)}) isn't counted again here — your home is counted as equity: its value minus the loan. `
            : ''}
          Super isn&rsquo;t included; it&rsquo;s on the Super tab.
        </p>
      </div>
    </Panel>
  )
}
