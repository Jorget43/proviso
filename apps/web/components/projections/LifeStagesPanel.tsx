'use client'
// Costs that follow ages (@proviso/core/lifeStages): the children (with a
// planned baby as a future birth year), where the household lives, and when
// children leave home. The amounts come from the same table the engine uses.
import { fmt } from '@proviso/core/formatting'
import { CHILD_STAGES, WORK_COST_MONTHLY, DEFAULT_LEAVE_HOME_AGE, MAX_LEAVE_HOME_AGE } from '@proviso/core/lifeStages'
import { childLabel, sortChildren } from '@proviso/core/people'

export interface ChildRow { id: number; name: string | null; birthYear: number; birthMonth: number | null; primarySchool?: string | null; secondarySchool?: string | null }

interface Props {
  on:            boolean
  leaveHomeAge:  number
  regional:      boolean
  kids:          ChildRow[]
  currentYear:   number
  onSettings:    (patch: { lifeStagesOn?: boolean; childLeavesHomeAge?: number }) => void
  onRegional:    (regional: boolean) => void
  onAddChild:    () => void
  onUpdateChild: (id: number, patch: Partial<Omit<ChildRow, 'id'>>) => void
  onDeleteChild: (id: number) => void
}

const STAY_LONGER_DEFAULT = 21

export default function LifeStagesPanel({
  on, leaveHomeAge, regional, kids, currentYear,
  onSettings, onRegional, onAddChild, onUpdateChild, onDeleteChild,
}: Props) {
  const sorted = sortChildren(kids)
  const staysLonger = leaveHomeAge > DEFAULT_LEAVE_HOME_AGE
  const work = regional ? WORK_COST_MONTHLY.regional : WORK_COST_MONTHLY.metro
  return (
    <div className="wp">
      <label className="super-toggle">
        <input type="checkbox" checked={on} onChange={e => onSettings({ lifeStagesOn: e.target.checked })} />
        <span className="super-toggle-text">
          Costs change as everyone gets older
          <small>Children cost more as they grow and less once they leave home, childcare stops at school, work costs stop at retirement, and spending eases from 85.</small>
        </span>
      </label>

      <div className="wp-field">
        <span>Where you live</span>
        <div className="seg" role="group" aria-label="Where you live">
          <button type="button" className={!regional ? 'on' : ''} aria-pressed={!regional} onClick={() => onRegional(false)}>Capital city</button>
          <button type="button" className={regional ? 'on' : ''} aria-pressed={regional} onClick={() => onRegional(true)}>Regional or rural</button>
        </div>
      </div>

      <p className="wp-intro">
        {kids.length === 0
          ? 'No children recorded. Add each child, or a baby you’re planning, so their costs follow their age.'
          : 'Each child’s costs follow their age. For a baby you’re planning, put the year you expect them.'}
      </p>
      <div className="wp-cards">
        {sorted.map((c, i) => {
          const age = currentYear - c.birthYear
          return (
            <div key={c.id} className="wp-card">
              <div className="wp-card-head">
                <strong>{childLabel(c, i + 1)}</strong>
                <button type="button" className="wp-remove" onClick={() => onDeleteChild(c.id)} aria-label={`Remove ${childLabel(c, i + 1)}`}>Remove</button>
              </div>
              <label className="wp-field">
                <span>Name (optional)</span>
                <input type="text" maxLength={40} key={`n-${c.id}-${c.name}`} defaultValue={c.name ?? ''}
                  onBlur={e => { const v = e.target.value.trim(); if (v !== (c.name ?? '')) onUpdateChild(c.id, { name: v || null }) }} />
              </label>
              <label className="wp-field">
                <span>Born in (or due)</span>
                <input type="number" inputMode="numeric" min={currentYear - 40} max={currentYear + 15}
                  key={`y-${c.id}-${c.birthYear}`} defaultValue={c.birthYear}
                  onBlur={e => { const v = parseInt(e.target.value); if (v && v !== c.birthYear) onUpdateChild(c.id, { birthYear: v }) }} />
              </label>
              <p className="wp-pay">{age < 0 ? `Due in ${c.birthYear}` : age === 0 ? 'A baby this year' : `${age} this year`}</p>
            </div>
          )
        })}
      </div>
      <button type="button" className="add-btn" onClick={onAddChild}>+ Add a child or a planned baby</button>

      <label className="super-toggle">
        <input type="checkbox" checked={staysLonger}
          onChange={e => onSettings({ childLeavesHomeAge: e.target.checked ? STAY_LONGER_DEFAULT : DEFAULT_LEAVE_HOME_AGE })} />
        <span className="super-toggle-text">
          Children stay at home past 18
          <small>Many young adults live at home while they study or start work.</small>
        </span>
      </label>
      {staysLonger && (
        <label className="wp-field">
          <span>They leave home at</span>
          <select value={leaveHomeAge} onChange={e => onSettings({ childLeavesHomeAge: parseInt(e.target.value) })}>
            {Array.from({ length: MAX_LEAVE_HOME_AGE - DEFAULT_LEAVE_HOME_AGE }, (_, k) => DEFAULT_LEAVE_HOME_AGE + 1 + k).map(a =>
              <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      )}

      <details className="wi-more">
        <summary>The typical costs used</summary>
        <p className="wp-intro">A month, in today’s money, {regional ? 'outside a capital city' : 'in a capital city'}. Not counting childcare, school fees or housing, which are worked out separately.</p>
        <ul className="ls-costs">
          {CHILD_STAGES.map(s => (
            <li key={s.key}>
              <span>{s.from === 18 ? `18 and over, at home` : `Ages ${s.from}–${s.to}`}</span>
              <strong>{fmt(regional ? s.regional : s.metro)}</strong>
            </li>
          ))}
          <li><span>Getting to work, full-time</span><strong>{fmt(work)}</strong></li>
        </ul>
        <p className="wp-intro">Children: AMP.NATSEM Cost of Kids (2013), brought to 2026 prices. Work: Real Insurance Commute Report 2025. From 85: ASFA Retirement Standard.</p>
      </details>
    </div>
  )
}
