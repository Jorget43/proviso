'use client'
// Income on top of pay (@proviso/core/businessIncome): a bonus or commission
// from a job (compulsory super is paid on it), and profit from a business,
// sole trading or gig work. One card each, like the packaging cards.

import { fmt } from '@proviso/core/formatting'

export interface IncomeSourceRow {
  id:        number
  person:    string
  kind:      string
  name:      string | null
  amount:    number
  growthPct: number
  startYear: number
  endYear:   number | null
}

interface Props {
  items:          IncomeSourceRow[]
  partnerEnabled: boolean
  person1Name:    string
  person2Name:    string
  /** Bonuses and business income a month this year after tax, from the budget. */
  monthlyAdds:    number
  onAdd:    (kind: 'business' | 'bonus') => void
  onUpdate: (id: number, patch: Partial<IncomeSourceRow>) => void
  onDelete: (id: number) => void
}

export default function BusinessPanel({ items, partnerEnabled, person1Name, person2Name, monthlyAdds, onAdd, onUpdate, onDelete }: Props) {
  const thisYear = new Date().getFullYear()
  const shown = items.filter(i => (i.kind === 'business' || i.kind === 'bonus') && (partnerEnabled || i.person === 'p1'))
  return (
    <>
      <p className="wp-intro">
        Money on top of regular pay. Both are taxed on top of pay and count towards HELP repayments.
        {monthlyAdds > 0 && <> This year they add about <strong>{fmt(monthlyAdds)}</strong> a month after tax.</>}
      </p>
      <div className="wp-cards">
        {shown.map(i => (
          <div key={i.id} className="wp-card">
            <div className="wp-card-head">
              <strong>{i.name || (i.kind === 'bonus' ? 'Bonus or commission' : 'Business')}</strong>
              <button type="button" className="wp-remove" onClick={() => onDelete(i.id)} aria-label={`Remove this ${i.kind === 'bonus' ? 'bonus' : 'business income'}`}>Remove</button>
            </div>
            <label className="wp-field">
              <span>Name (optional)</span>
              <input type="text" maxLength={60} defaultValue={i.name ?? ''}
                onBlur={e => onUpdate(i.id, { name: e.target.value.trim() || null })} />
            </label>
            {partnerEnabled && (
              <label className="wp-field">
                <span>Whose income</span>
                <select value={i.person} onChange={e => onUpdate(i.id, { person: e.target.value })}>
                  <option value="p1">{person1Name}</option>
                  <option value="p2">{person2Name}</option>
                </select>
              </label>
            )}
            <label className="wp-field">
              <span>{i.kind === 'bonus' ? 'A typical year’s bonus or commission, before tax' : 'Profit a year, before income tax'}</span>
              <input type="number" inputMode="decimal" min={0} step={500} defaultValue={i.amount}
                onBlur={e => onUpdate(i.id, { amount: Math.max(0, parseFloat(e.target.value) || 0) })} />
            </label>
            <label className="wp-field">
              <span>Grows each year (%)</span>
              <input type="number" inputMode="decimal" min={-10} max={20} step={0.5} defaultValue={i.growthPct}
                onBlur={e => onUpdate(i.id, { growthPct: Math.min(20, Math.max(-10, parseFloat(e.target.value) || 0)) })} />
            </label>
            <label className="wp-field">
              <span>From the year</span>
              <input type="number" inputMode="numeric" min={thisYear - 20} max={thisYear + 40} defaultValue={i.startYear}
                onBlur={e => onUpdate(i.id, { startYear: parseInt(e.target.value) || i.startYear })} />
            </label>
            <label className="wp-field">
              <span>Until the year (blank: until work stops)</span>
              <input type="number" inputMode="numeric" min={thisYear - 20} max={thisYear + 60} defaultValue={i.endYear ?? ''}
                onBlur={e => onUpdate(i.id, { endYear: e.target.value.trim() === '' ? null : parseInt(e.target.value) || null })} />
            </label>
            <p className="wp-pay">{i.kind === 'bonus'
              ? 'Your employer pays super on it too. It stops when work stops, unless you set a last year.'
              : 'What’s left after the business’s own costs. A loss counts as nothing. No super is paid on it for you, so consider putting some in yourself.'}</p>
          </div>
        ))}
      </div>
      <div className="pk-add">
        <button type="button" className="add-btn" onClick={() => onAdd('bonus')}>+ Bonus or commission</button>
        <button type="button" className="add-btn" onClick={() => onAdd('business')}>+ Business income</button>
      </div>
    </>
  )
}
