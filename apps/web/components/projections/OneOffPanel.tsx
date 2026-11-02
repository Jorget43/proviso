'use client'

// Big one-offs: costs paid in a year (a car, a wedding) and money coming
// in at once (an inheritance, selling something, borrowing against the
// home). The engine treats each kind as @proviso/core/projections OneOffKind.

export interface OneOffRow {
  id:    number
  name:  string
  amt:   number
  year:  number
  kind?: string
}

interface OneOffPanelProps {
  oneoffs:  OneOffRow[]
  onAdd:    () => void
  onUpdate: (id: number, field: string, value: string | number) => void
  onDelete: (id: number) => void
}

const KINDS: { key: string; label: string; hint: string }[] = [
  { key: 'cost',   label: 'A cost',                       hint: 'Paid out of savings that year.' },
  { key: 'gift',   label: 'An inheritance or gift',       hint: 'Money in, not taxed. It goes into savings, then is invested like any money left over.' },
  { key: 'sale',   label: 'Selling something',            hint: 'Money in from a sale. Capital gains tax isn’t worked out, so enter what you’d keep.' },
  { key: 'borrow', label: 'Borrowing against the home',   hint: 'Money in, with the same added to the home loan (a top-up or refinance). Repayments stay the same, so the loan runs longer.' },
]

export default function OneOffPanel({ oneoffs, onAdd, onUpdate, onDelete }: OneOffPanelProps) {
  const sorted = [...oneoffs].sort((a, b) => a.year - b.year)
  const known = (k?: string) => KINDS.find(x => x.key === (k ?? 'cost')) ?? KINDS[0]

  return (
    <div className="wk">
      <p className="wp-intro">Big costs in a particular year, and money that arrives all at once.</p>
      <ul className="wk-list">
        {sorted.map(o => {
          const kind = known(o.kind)
          const moneyIn = kind.key !== 'cost'
          return (
            <li key={o.id} className={`wk-row${moneyIn ? ' now' : ''}`}>
              <div className="wk-row-head">
                <span className="wk-tag">{moneyIn ? 'Money in' : 'Cost'}</span>
                <button type="button" className="wp-remove" onClick={() => onDelete(o.id)} aria-label={`Remove ${o.name}`}>Remove</button>
              </div>
              <div className="wk-fields">
                <label className="wk-field" style={{ flex: '1 1 180px' }}><span>What is it?</span>
                  <select value={kind.key} onChange={e => onUpdate(o.id, 'kind', e.target.value)}>
                    {KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                </label>
                <label className="wk-field" style={{ flex: '1 1 160px' }}><span>Name</span>
                  <input className="wk-input" defaultValue={o.name} maxLength={60} onBlur={e => onUpdate(o.id, 'name', e.target.value)} />
                </label>
                <label className="wk-field"><span>Amount</span>
                  <span className="input-prefix wk-money"><span>$</span>
                    <input type="number" inputMode="decimal" min={0} defaultValue={o.amt}
                      onBlur={e => onUpdate(o.id, 'amt', Math.max(0, parseFloat(e.target.value) || 0))} />
                  </span>
                </label>
                <label className="wk-field"><span>Year</span>
                  <input className="wk-input narrow" type="number" inputMode="numeric" defaultValue={o.year}
                    onBlur={e => onUpdate(o.id, 'year', parseInt(e.target.value) || o.year)} />
                </label>
              </div>
              <p className="wp-pay">{kind.hint}</p>
            </li>
          )
        })}
      </ul>
      <button type="button" className="add-btn" onClick={onAdd}>+ Add a cost or money coming in</button>
    </div>
  )
}
