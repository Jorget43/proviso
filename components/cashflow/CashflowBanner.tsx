import { fmt, fmtS } from '@/lib/formatting'

interface CashflowBannerProps {
  delta: number
  leaveDelta: number
  burnDelta: number
  cashOnHand: number
  runway: number
}

export default function CashflowBanner({ delta, leaveDelta, burnDelta, cashOnHand, runway }: CashflowBannerProps) {
  return (
    <div className="banner">
      <div className="b-item">
        <div className="b-label">Monthly surplus</div>
        <div className={`b-value ${delta >= 0 ? 'green' : 'red'}`}>{fmtS(delta)}</div>
      </div>
      <div className="b-div" />
      <div className="b-item">
        <div className="b-label">On leave + PPL</div>
        <div className={`b-value ${leaveDelta >= 0 ? 'green' : 'red'}`}>{fmtS(leaveDelta)}/mo</div>
      </div>
      <div className="b-div" />
      <div className="b-item">
        <div className="b-label">After PPL (Jorge only)</div>
        <div className="b-value red">{fmtS(burnDelta)}/mo</div>
      </div>
      <div className="b-div" />
      <div className="b-item">
        <div className="b-label">Cash on hand</div>
        <div className="b-value">{fmt(cashOnHand)}</div>
      </div>
      <div className="b-div" />
      <div className="b-item">
        <div className="b-label">Runway (Jorge only)</div>
        <div className={`b-value ${runway >= 6 ? 'green' : 'red'}`}>
          {runway === Infinity ? '∞' : runway.toFixed(1)} mo
        </div>
      </div>
    </div>
  )
}
