'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Panel from '@/components/ui/Panel'
import type { Situation } from '@/lib/situation'

// One list of plain-language switches for the situations that add whole
// sections to the app. Each writes to the settings row that owns the flag;
// the matching sections appear (or disappear) everywhere straight away.

type Key = 'childcare' | 'renting' | 'buying' | 'schoolFees' | 'parentalLeave'

const WRITES: Record<Key, (on: boolean) => { url: string; body: object }> = {
  childcare:     on => ({ url: '/api/childcare-settings',  body: { enabled: on } }),
  renting:       on => ({ url: '/api/rent-settings',       body: on ? { enabled: true } : { enabled: false, purchasePlanEnabled: false } }),
  buying:        on => ({ url: '/api/rent-settings',       body: { purchasePlanEnabled: on } }),
  schoolFees:    on => ({ url: '/api/projection-settings', body: { schoolFeesOn: on } }),
  parentalLeave: on => ({ url: '/api/projection-settings', body: { parentalLeaveEnabled: on } }),
}

interface Props {
  initial:     Situation
  canEdit:     boolean
  person2Name: string
}

export default function SituationPanel({ initial, canEdit, person2Name }: Props) {
  const router = useRouter()
  const [s, setS] = useState<Situation>(initial)
  const [error, setError] = useState<string | null>(null)

  async function toggle(key: Key, on: boolean) {
    const prev = s
    setS(cur => ({ ...cur, [key]: on, ...(key === 'renting' && !on ? { buying: false } : {}) }))
    setError(null)
    const { url, body } = WRITES[key](on)
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Handles-Errors': '1' },
      body: JSON.stringify(body),
    }).catch(() => null)
    if (!res?.ok) { setS(prev); setError('That didn’t save — please try again.'); return }
    router.refresh()
  }

  const rows: { key: Key; title: string; detail: string; where: string; href: string; show: boolean }[] = [
    { key: 'renting', title: 'We rent our home', detail: 'Rent goes into your budget and long-term plan instead of a home loan.', where: 'Budget · Future', href: '/projections', show: true },
    { key: 'buying', title: 'We’re planning to buy', detail: 'Plan a deposit, purchase year and new home loan.', where: 'Future → What if? → Home', href: '/projections', show: s.renting },
    { key: 'childcare', title: 'We pay for childcare', detail: 'Adds childcare to your budget with the Child Care Subsidy worked out for you.', where: 'Budget', href: '/budget', show: true },
    { key: 'schoolFees', title: 'Plan for school fees', detail: 'Adds school fees for up to two children to your long-term plan.', where: 'Future → What if? → Plans', href: '/projections', show: true },
    { key: 'parentalLeave', title: 'Parental leave coming up', detail: `Models ${person2Name} taking leave, with Parental Leave Pay.`, where: 'Future', href: '/cashflow', show: s.partnerEnabled },
  ]

  return (
    <div id="situation">
      <Panel title="Your situation">
        <p className="situation-intro">Switch on what applies to you. Each one adds the matching sections to the app — nothing else changes.</p>
        <ul className="situation-list">
          <li className="situation-row">
            <div className="situation-text">
              <strong>{s.partnerEnabled ? `Sharing with ${person2Name}` : 'Just me'}</strong>
              <span>Who&rsquo;s in the household. {canEdit && <>Change this with the <a href="#rerun">setup wizard</a>.</>}</span>
            </div>
          </li>
          {rows.filter(r => r.show).map(r => (
            <li key={r.key} className={`situation-row${r.key === 'buying' ? ' nested' : ''}`}>
              <label className="situation-text" htmlFor={`sit-${r.key}`}>
                <strong>{r.title}</strong>
                <span>{r.detail}</span>
                {s[r.key] && <Link href={r.href} className="situation-where">Shows in {r.where} →</Link>}
              </label>
              <label className="toggle-switch situation-toggle">
                <input id={`sit-${r.key}`} type="checkbox" checked={s[r.key]} disabled={!canEdit}
                  onChange={e => toggle(r.key, e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="sheet-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      </Panel>
    </div>
  )
}
