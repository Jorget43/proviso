'use client'
import { useState } from 'react'
import { CATS } from '@/lib/constants'
import { fmt, toMonthly } from '@/lib/formatting'
import BottomSheet from '@/components/ui/BottomSheet'

// One editor for every kind of budget line. "Regular" lines (weekly, monthly,
// quarterly, yearly) and "annual" bills (once a year, in a known month) are
// separate records, but to the user they're just "how often" — picking Yearly
// plus a due month makes an annual bill; Yearly without a month is a regular
// yearly line spread across the year.

export type Freq = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type LineKind = 'regular' | 'annual' | 'rent'

export interface LineDraft {
  name:  string
  cat:   string
  freq:  Freq
  amt:   string
  month: number   // 1–12 when due in a known month (yearly only); 0 = not set
}

export interface SheetTarget {
  kind:     LineKind
  id:       number | null     // null when adding
  draft:    LineDraft
  managed?: boolean           // the CCS-calculated childcare line
}

const FREQ_LABELS: [Freq, string][] = [
  ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly'],
]
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function kindOf(d: LineDraft): 'regular' | 'annual' {
  return d.freq === 'yearly' && d.month > 0 ? 'annual' : 'regular'
}

interface ExpenseSheetProps {
  target:   SheetTarget | null
  canEdit:  boolean
  onClose:  () => void
  onSave:   (target: SheetTarget, draft: LineDraft) => Promise<void>
  onDelete: (target: SheetTarget) => Promise<void>
}

export default function ExpenseSheet(props: ExpenseSheetProps) {
  const { target, onClose } = props
  const title = !target ? '' : target.id === null ? 'Add a cost' : target.kind === 'rent' ? 'Rent' : 'Edit cost'
  return (
    <BottomSheet open={target !== null} title={title} onClose={onClose}>
      {/* Keyed so each opening starts from that line's saved values */}
      {target && <SheetForm key={`${target.kind}-${target.id ?? 'new'}-${target.draft.cat}`} {...props} target={target} />}
    </BottomSheet>
  )
}

function SheetForm({ target, canEdit, onClose, onSave, onDelete }: ExpenseSheetProps & { target: SheetTarget }) {
  const [d, setD] = useState<LineDraft>(target.draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<LineDraft>) => setD(prev => ({ ...prev, ...patch }))

  const isRent = target.kind === 'rent'
  const locked = !canEdit
  const amt = parseFloat(d.amt) || 0
  const monthly = toMonthly(amt, d.freq)
  const valid = isRent || d.name.trim().length > 0

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null)
    try { await fn(); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong — please try again.') }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); if (valid) run(() => onSave(target, d)) }}>
      {!isRent && (
        <label className="field">
          <span>What is it?</span>
          <input value={d.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Groceries" disabled={locked || target.managed} required maxLength={200} />
        </label>
      )}

      <label className="field">
        <span>How much?</span>
        <div className="field-money">
          <input
            type="number" inputMode="decimal" step="any" min="0"
            value={d.amt}
            onChange={e => set({ amt: e.target.value })}
            disabled={locked || target.managed}
            placeholder="0"
            autoFocus={target.id === null}
          />
        </div>
      </label>

      {target.managed && (
        <p className="sheet-note">Worked out from your childcare settings after the Child Care Subsidy. Change it there.</p>
      )}

      {!isRent && !target.managed && (
        <>
          <div className="field">
            <span>How often?</span>
            <div className="seg" role="radiogroup" aria-label="How often">
              {FREQ_LABELS.map(([f, label]) => (
                <button key={f} type="button" role="radio" aria-checked={d.freq === f}
                  className={d.freq === f ? 'on' : ''} disabled={locked}
                  onClick={() => set({ freq: f, month: f === 'yearly' ? d.month : 0 })}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {d.freq === 'yearly' && (
            <label className="field">
              <span>When is it due?</span>
              <select value={d.month} onChange={e => set({ month: Number(e.target.value) })} disabled={locked}>
                <option value={0}>Not sure / spread across the year</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
          )}

          <label className="field">
            <span>Category</span>
            <select value={d.cat} onChange={e => set({ cat: e.target.value })} disabled={locked}>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              {!(CATS as readonly string[]).includes(d.cat) && <option value={d.cat}>{d.cat}</option>}
            </select>
          </label>
        </>
      )}

      {amt > 0 && d.freq !== 'monthly' && (
        <p className="sheet-note">That&rsquo;s about <strong>{fmt(monthly)}</strong> a month{d.freq === 'yearly' && d.month > 0 ? `, paid in ${MONTHS[d.month - 1]}` : ''}.</p>
      )}

      {error && <p className="sheet-error" role="alert">{error}</p>}

      {canEdit && (
        <div className="sheet-actions">
          {target.id !== null && !isRent && !target.managed && (
            <button type="button" className="btn btn-danger" disabled={busy}
              onClick={() => run(() => onDelete(target))}>
              Delete
            </button>
          )}
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          {!target.managed && (
            <button type="submit" className="btn btn-primary" disabled={busy || !valid}>
              {busy ? 'Saving…' : target.id === null ? 'Add' : 'Save'}
            </button>
          )}
        </div>
      )}
    </form>
  )
}
