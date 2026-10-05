'use client'
import { useState } from 'react'
import { CATS, CAT_COLORS } from '@/lib/constants'
import { fmt, toMonthly } from '@/lib/formatting'
import { isManagedChildcare } from '@/lib/budgetSummary'
import type { Expense, AnnualExpense } from './ExpenseTable'
import type { Freq, SheetTarget } from './ExpenseSheet'

// Phone layout for the budget: one card per category with its monthly total;
// tap a card to see its lines, tap a line to edit it in a sheet. (Desktop
// keeps the inline-editing table in ExpenseTable.)

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FREQ_WORD: Record<string, string> = { weekly: 'a week', monthly: 'a month', quarterly: 'a quarter', yearly: 'a year' }

interface ExpenseListProps {
  expenses:       Expense[]
  annualExpenses: AnnualExpense[]
  rentMonthly?:   number
  monthlyTotal:   number
  canEdit:        boolean
  onOpen:         (target: SheetTarget) => void
}

export default function ExpenseList({ expenses, annualExpenses, rentMonthly, monthlyTotal, canEdit, onOpen }: ExpenseListProps) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (cat: string) => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(cat)) next.delete(cat); else next.add(cat)
    return next
  })

  const extraCats = [...new Set([...expenses, ...annualExpenses].map(e => e.cat))]
    .filter(c => !(CATS as readonly string[]).includes(c))
  const cats = [...CATS, ...extraCats]

  const groups = cats.map((cat, i) => {
    const items   = expenses.filter(e => e.cat === cat)
    const annuals = annualExpenses.filter(a => a.cat === cat)
    const monthly = items.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0) + annuals.reduce((s, a) => s + a.amt / 12, 0)
    return { cat, color: CAT_COLORS[i % CAT_COLORS.length], items, annuals, monthly }
  }).filter(g => g.items.length || g.annuals.length)

  const addTarget = (cat: string): SheetTarget => ({
    kind: 'regular', id: null, draft: { name: '', cat, freq: 'monthly', amt: '', month: 0 },
  })

  return (
    <div className="exp-list">
      {rentMonthly !== undefined && (
        <div className="exp-cat">
          <button type="button" className="exp-row exp-row-solo" disabled={!canEdit}
            onClick={() => onOpen({ kind: 'rent', id: null, draft: { name: 'Rent', cat: 'Home', freq: 'monthly', amt: String(rentMonthly), month: 0 } })}>
            <span className="exp-row-main">
              <span className="exp-row-name">Rent</span>
              <span className="exp-row-sub">from your renting settings</span>
            </span>
            <span className="exp-row-amt">{fmt(rentMonthly)}<small>/mo</small></span>
          </button>
        </div>
      )}

      {groups.map(g => {
        const isOpen = open.has(g.cat)
        const share = monthlyTotal > 0 ? g.monthly / monthlyTotal : 0
        return (
          <div key={g.cat} className={`exp-cat${isOpen ? ' open' : ''}`}>
            <button type="button" className="exp-cat-head" onClick={() => toggle(g.cat)} aria-expanded={isOpen}>
              <span className="exp-cat-dot" style={{ background: g.color }} />
              <span className="exp-cat-name">
                {g.cat}
                <span className="exp-cat-count">{g.items.length + g.annuals.length} item{g.items.length + g.annuals.length === 1 ? '' : 's'}</span>
              </span>
              <span className="exp-cat-amt">{fmt(g.monthly)}<small>/mo</small></span>
              <span className="exp-cat-chev" aria-hidden="true">›</span>
              <span className="exp-cat-bar" style={{ width: `${Math.max(share * 100, 1)}%`, background: g.color }} />
            </button>

            {isOpen && (
              <div className="exp-cat-body">
                {g.items.map(e => {
                  const managed = isManagedChildcare(e)
                  return (
                    <button key={e.id} type="button" className="exp-row"
                      onClick={() => onOpen({
                        kind: 'regular', id: e.id, managed,
                        draft: { name: e.name, cat: e.cat, freq: e.freq as Freq, amt: String(e.amt), month: 0 },
                      })}>
                      <span className="exp-row-main">
                        <span className="exp-row-name">{e.name}</span>
                        <span className="exp-row-sub">
                          {managed ? 'after the childcare subsidy' : e.freq === 'monthly' ? 'monthly' : `${fmt(e.amt)} ${FREQ_WORD[e.freq] ?? e.freq}`}
                        </span>
                      </span>
                      <span className="exp-row-amt">{fmt(toMonthly(e.amt, e.freq))}<small>/mo</small></span>
                    </button>
                  )
                })}
                {g.annuals.map(a => (
                  <button key={`a${a.id}`} type="button" className="exp-row"
                    onClick={() => onOpen({
                      kind: 'annual', id: a.id,
                      draft: { name: a.name, cat: a.cat, freq: 'yearly', amt: String(a.amt), month: a.month },
                    })}>
                    <span className="exp-row-main">
                      <span className="exp-row-name">{a.name}</span>
                      <span className="exp-row-sub">{fmt(a.amt)} each {MONTH_SHORT[a.month - 1]}</span>
                    </span>
                    <span className="exp-row-amt">{fmt(a.amt / 12)}<small>/mo</small></span>
                  </button>
                ))}
                {canEdit && (
                  <button type="button" className="exp-add" onClick={() => onOpen(addTarget(g.cat))}>
                    + Add to {g.cat}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {canEdit && (
        <button type="button" className="btn btn-primary exp-add-main" onClick={() => onOpen(addTarget('Home'))}>
          + Add a cost
        </button>
      )}
    </div>
  )
}
