import { LUMPY } from '@/lib/constants'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function LumpyMonths() {
  const byMonth: Record<number, typeof LUMPY> = {}
  LUMPY.forEach(l => {
    if (!byMonth[l.month]) byMonth[l.month] = []
    byMonth[l.month].push(l)
  })

  return (
    <Panel title="Lumpy months" dotColor="var(--teal)">
      <div className="lumpy-grid">
        {Object.entries(byMonth)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([m, items]) => {
            const total = items.reduce((s, i) => s + i.amt, 0)
            return (
              <div className="lumpy-month" key={m}>
                <h4>
                  {MONTH_NAMES[Number(m) - 1]}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--t3)' }}>
                    &mdash; {fmt(total)} extra
                  </span>
                </h4>
                {items.map(i => (
                  <div className="lumpy-item" key={i.name}>
                    {i.name} <span>{fmt(i.amt)}</span>
                  </div>
                ))}
              </div>
            )
          })}
      </div>
      <p className="proj-note">
        These hit your cashflow in specific months, separate from the amortised monthly budget.
      </p>
    </Panel>
  )
}
