'use client'
// Salary packaging (@proviso/core/packaging): part of someone's pay going to
// costs before tax. One card per item, like the work-pattern cards.

import { fmt } from '@proviso/core/formatting'
import { possessive } from '@proviso/core/formatting'
import {
  PACKAGE_LABELS, capFor, evStatus, EV_PRICE_LIMIT, EV_ANNOUNCED_FULL_EXEMPT_PRICE, type PackageKind,
} from '@proviso/core/packaging'

export interface PackagedItemRow {
  id:        number
  person:    string
  kind:      string
  amount:    number
  carPrice:  number | null
  startYear: number
  endYear:   number | null
}

interface Props {
  items:          PackagedItemRow[]
  partnerEnabled: boolean
  person1Name:    string
  person2Name:    string
  /** Extra take-home pay a month this year, from the budget. */
  monthlySaving:  number
  onAdd:    (kind: PackageKind) => void
  onUpdate: (id: number, patch: Partial<PackagedItemRow>) => void
  onDelete: (id: number) => void
}

const KINDS: PackageKind[] = ['pbi', 'hospital', 'mealEntertainment', 'evLease']

function capNote(kind: string): string | null {
  if (kind === 'pbi' || kind === 'hospital' || kind === 'mealEntertainment') return `Up to ${fmt(capFor(kind))} a year is tax-free.`
  return null
}

function carNote(i: PackagedItemRow): { text: string; warn: boolean } {
  const s = evStatus(i.carPrice, i.startYear)
  if (s === 'overPriceLimit') return { warn: true, text: `Cars costing ${fmt(EV_PRICE_LIMIT)} or more aren’t exempt, so this isn’t counted.` }
  if (s === 'announcedChange') return { warn: true, text: `Announced, not yet law: leases from April 2027 on cars over ${fmt(EV_ANNOUNCED_FULL_EXEMPT_PRICE)} lose most of the exemption, so this isn’t counted.` }
  return { warn: false, text: 'Exempt from fringe benefits tax. It still counts towards HELP repayments.' }
}

export default function PackagingPanel({ items, partnerEnabled, person1Name, person2Name, monthlySaving, onAdd, onUpdate, onDelete }: Props) {
  const thisYear = new Date().getFullYear()
  const shown = items.filter(i => partnerEnabled || i.person === 'p1')
  return (
    <>
      <p className="wp-intro">
        Part of your pay can go to some costs before tax, so less of it is taxed: up to a cap if you work for a charity or a
        public hospital, or the lease and running costs of an electric car. Keep the costs in your budget as they are.
        {monthlySaving > 0 && <> This year it adds about <strong>{fmt(monthlySaving)}</strong> a month to your take-home pay.</>}
      </p>
      <div className="wp-cards">
        {shown.map(i => {
          const car = i.kind === 'evLease' ? carNote(i) : null
          const cap = capNote(i.kind)
          return (
            <div key={i.id} className="wp-card">
              <div className="wp-card-head">
                <strong>{PACKAGE_LABELS[i.kind as PackageKind] ?? 'Packaging'}</strong>
                <button type="button" className="wp-remove" onClick={() => onDelete(i.id)} aria-label="Remove this packaging">Remove</button>
              </div>
              {partnerEnabled && (
                <label className="wp-field">
                  <span>From whose pay</span>
                  <select value={i.person} onChange={e => onUpdate(i.id, { person: e.target.value })}>
                    <option value="p1">{possessive(person1Name)}</option>
                    <option value="p2">{possessive(person2Name)}</option>
                  </select>
                </label>
              )}
              <label className="wp-field">
                <span>{i.kind === 'evLease' ? 'Lease and running costs a year' : 'Packaged a year'}</span>
                <input type="number" inputMode="decimal" min={0} step={100} defaultValue={i.amount}
                  onBlur={e => onUpdate(i.id, { amount: Math.max(0, parseFloat(e.target.value) || 0) })} />
              </label>
              {i.kind === 'evLease' && (
                <label className="wp-field">
                  <span>The car’s price</span>
                  <input type="number" inputMode="decimal" min={0} step={1000} defaultValue={i.carPrice ?? 0}
                    onBlur={e => onUpdate(i.id, { carPrice: Math.max(0, parseFloat(e.target.value) || 0) })} />
                </label>
              )}
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
              {cap && <p className="wp-pay">{cap}</p>}
              {car && <p className={car.warn ? 'wp-pay warn' : 'wp-pay'}>{car.text}</p>}
            </div>
          )
        })}
      </div>
      <div className="pk-add">
        {KINDS.map(k => (
          <button key={k} type="button" className="add-btn" onClick={() => onAdd(k)}>+ {PACKAGE_LABELS[k]}</button>
        ))}
      </div>
    </>
  )
}
