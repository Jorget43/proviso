import type { HouseholdSuperResult, SuperRow } from '@/lib/super'

function c(n: number) {
  if (n === 0) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return `$${Math.round(n).toLocaleString('en-AU')}`
}

function PersonTable({ rows, name }: { rows: SuperRow[]; name: string }) {
  const accRows = rows.filter(r => r.phase === 'accumulation')
  const ddRows  = rows.filter(r => r.phase === 'drawdown')

  return (
    <>
      <div className="super-phase-sep" style={{ background: 'var(--surface2)', color: 'var(--t1)' }}>
        {name} — Accumulation
      </div>
      <table className="super-table">
        <thead>
          <tr>
            <th>Age</th>
            <th className="super-col-sec">Year</th>
            <th>Balance</th>
            <th className="super-col-sec">Earnings</th>
            <th className="super-col-sec">Earn. Tax</th>
            <th>Contribution</th>
            <th className="super-col-sec">Contrib. Tax</th>
            <th className="super-col-sec">Fees</th>
            <th className="super-col-sec">Salary</th>
            <th>PV (today's $)</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {accRows.map(r => (
            <tr key={r.count} className={r.capHit ? 'super-cap-hit' : ''}>
              <td>{r.age}</td>
              <td className="super-col-sec">{r.year}</td>
              <td className="super-num">{c(r.balance)}</td>
              <td className="super-num super-col-sec">{c(r.earnings)}</td>
              <td className="super-num super-tax super-col-sec">{c(r.earningsTax)}</td>
              <td className="super-num">{c(r.contribution)}</td>
              <td className="super-num super-tax super-col-sec">{c(r.contributionTax)}</td>
              <td className="super-num super-tax super-col-sec">{c(r.fees)}</td>
              <td className="super-num super-col-sec">{c(r.salary)}</td>
              <td className="super-num super-pv">{c(r.presentValue)}</td>
              <td>
                {r.capHit && <span className="super-badge cap">Cap</span>}
                {r.div293 && <span className="super-badge div">Div293</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {ddRows.length > 0 && (
        <>
          <div className="super-phase-sep">{name} — Drawdown</div>
          <table className="super-table">
            <thead>
              <tr>
                <th>Age</th>
                <th className="super-col-sec">Year</th>
                <th>Balance</th>
                <th className="super-col-sec">Earnings</th>
                <th className="super-col-sec">Earn. Tax</th>
                <th>Drawdown</th>
                <th className="super-col-sec" colSpan={2}>Fees</th>
                <th className="super-col-sec"></th>
                <th>PV (today's $)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ddRows.map(r => (
                <tr key={r.count} className={r.balance === 0 ? 'super-depleted' : ''}>
                  <td>{r.age}</td>
                  <td className="super-col-sec">{r.year}</td>
                  <td className="super-num">{c(r.balance)}</td>
                  <td className="super-num super-col-sec">{c(r.earnings)}</td>
                  <td className="super-num super-tax super-col-sec">—</td>
                  <td className="super-num super-draw">{c(r.drawdown)}</td>
                  <td className="super-num super-tax super-col-sec" colSpan={2}>{c(r.fees)}</td>
                  <td className="super-col-sec"></td>
                  <td className="super-num super-pv">{c(r.presentValue)}</td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}

interface Props {
  result: HouseholdSuperResult
}

export default function SuperProjectionTable({ result }: Props) {
  return (
    <div className="super-table-wrap">
      <PersonTable rows={result.jorge.rows} name="Person1" />
      {result.grace && (
        <PersonTable rows={result.grace.rows} name="Person2" />
      )}
    </div>
  )
}
