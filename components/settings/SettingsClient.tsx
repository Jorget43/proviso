'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'
import MembersPanel, { type Member } from './MembersPanel'
import SecurityPanel from './SecurityPanel'
import PasskeyPanel from './PasskeyPanel'
import SituationPanel from './SituationPanel'
import type { Situation } from '@/lib/situation'

interface Props {
  person1Name:          string
  person2Name:          string
  partnerEnabled:       boolean
  person1FTE:           number
  person2FTE:           number
  mortgageBalance:      number
  superBalance:         number
  partnerSuperBalance:  number
  situation:            Situation
  currentRole:          string
  currentUserId:        number
  users:                Member[]
  hasTOTP:              boolean
  passkeys:             { id: number; name: string; deviceType: string; backedUp: boolean; createdAt: string }[]
  watchdog:             { attention: number } | null
  buildVersion:         string
  buildDate:            string | null
}

export default function SettingsClient({
  person1Name, person2Name, partnerEnabled,
  person1FTE, person2FTE, mortgageBalance,
  superBalance, partnerSuperBalance,
  situation,
  currentRole, currentUserId, users, hasTOTP, passkeys, watchdog, buildVersion, buildDate,
}: Props) {
  const isCfo = currentRole === 'CFO'
  const router   = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [names, setNames] = useState({ person1Name, person2Name })
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingNames, setSavingNames] = useState(false)
  const namesChanged = names.person1Name.trim() !== person1Name || (partnerEnabled && names.person2Name.trim() !== person2Name)

  async function saveNames(e: React.FormEvent) {
    e.preventDefault()
    setSavingNames(true)
    setNameMsg(null)
    const res = await fetch('/api/household', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Handles-Errors': '1' },
      body:    JSON.stringify(partnerEnabled ? names : { person1Name: names.person1Name }),
    })
    const data = await res.json().catch(() => ({}))
    setSavingNames(false)
    if (!res.ok) {
      setNameMsg({ ok: false, text: typeof data.error === 'string' && data.error !== 'Validation failed' ? data.error : 'Names must be 1–40 characters' })
      return
    }
    setNameMsg({ ok: true, text: 'Names updated — history, HELP and investments follow automatically.' })
    router.refresh()
  }

  async function rerunWizard() {
    setBusy(true)
    await fetch('/api/settings', { method: 'POST' })
    setDone(true)
    setTimeout(() => router.push('/onboarding'), 800)
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.6rem', fontWeight: 400, marginBottom: '1.5rem' }}>
        Household settings
      </h1>

      <Panel title="Household">
        <div className="da-grid" style={{ gap: '0.6rem' }}>
          {isCfo ? (
            <form onSubmit={saveNames} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div className="da-row">
                <label className="da-label" htmlFor="person1Name">Person 1</label>
                <input id="person1Name" className="da-input" maxLength={40} value={names.person1Name}
                  onChange={e => setNames(n => ({ ...n, person1Name: e.target.value }))} />
              </div>
              {partnerEnabled && (
                <div className="da-row">
                  <label className="da-label" htmlFor="person2Name">Person 2</label>
                  <input id="person2Name" className="da-input" maxLength={40} value={names.person2Name}
                    onChange={e => setNames(n => ({ ...n, person2Name: e.target.value }))} />
                </div>
              )}
              {(namesChanged || nameMsg) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.74rem' }}>
                  {namesChanged && <button type="submit" className="add-btn" disabled={savingNames}>{savingNames ? 'Saving…' : 'Save names'}</button>}
                  {nameMsg && <span style={{ color: nameMsg.ok ? 'var(--green)' : 'var(--red)' }}>{nameMsg.text}</span>}
                </div>
              )}
            </form>
          ) : (
            <>
              <div className="da-row"><span className="da-label">Person 1</span><span>{person1Name}</span></div>
              <div className="da-row"><span className="da-label">Person 2</span><span>{partnerEnabled ? person2Name : '—'}</span></div>
            </>
          )}
          <div className="da-row"><span className="da-label">{person1Name} income</span><span>{fmt(person1FTE)}/yr</span></div>
          {partnerEnabled && <div className="da-row"><span className="da-label">{person2Name} income</span><span>{fmt(person2FTE)}/yr</span></div>}
          <div className="da-row"><span className="da-label">Mortgage balance</span><span>{mortgageBalance > 0 ? fmt(mortgageBalance) : '—'}</span></div>
          <div className="da-row"><span className="da-label">{person1Name} super</span><span>{fmt(superBalance)}</span></div>
          {partnerEnabled && <div className="da-row"><span className="da-label">{person2Name} super</span><span>{fmt(partnerSuperBalance)}</span></div>}
        </div>
      </Panel>

      <div style={{ marginTop: '1.5rem' }}>
        <SituationPanel initial={situation} canEdit={isCfo} person2Name={person2Name} />
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <SecurityPanel hasTOTP={hasTOTP} />
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <PasskeyPanel initialPasskeys={passkeys} />
      </div>

      {isCfo && (
        <div style={{ marginTop: '1.5rem' }}>
          <MembersPanel users={users} currentUserId={currentUserId} />
        </div>
      )}

      {isCfo && (
        <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Activity log</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--t2)' }}>
              Sign-ins, security changes and edits to household data, kept for a year.
            </div>
          </div>
          <Link href="/settings/activity" className="hint-link" style={{ fontSize: '0.78rem' }}>Open →</Link>
        </div>
      )}

      {isCfo && (
      <div id="rerun" style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.4rem' }}>Re-run setup wizard</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--t2)', marginBottom: '1rem', lineHeight: 1.5 }}>
          This will restart the onboarding questionnaire. Your existing data will not be deleted — the wizard will update the values you enter and leave everything else intact.
        </p>
        <button
          className="add-btn"
          onClick={rerunWizard}
          disabled={busy}
          style={{ background: done ? 'var(--green-lt)' : undefined, color: done ? 'var(--green)' : undefined }}
        >
          {done ? 'Redirecting…' : busy ? 'Loading…' : 'Re-run setup wizard →'}
        </button>
      </div>
      )}

      {watchdog && (
        <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Assumptions watchdog</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--t2)' }}>
              {watchdog.attention > 0
                ? `${watchdog.attention} tax/super assumption${watchdog.attention === 1 ? '' : 's'} due for review.`
                : 'All tracked assumptions current.'}
            </div>
          </div>
          {watchdog.attention > 0 && (
            <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-lt)', borderRadius: 999, padding: '2px 9px' }}>
              {watchdog.attention}
            </span>
          )}
          <Link href="/admin/watchdog" className="hint-link" style={{ fontSize: '0.78rem' }}>Open →</Link>
        </div>
      )}

      <div style={{ marginTop: '1.25rem', fontSize: '0.72rem', color: 'var(--t3)' }}>
        {isCfo
          ? 'To edit individual figures (incomes, expenses, super balances, debts) use Spending, Wealth or Future.'
          : 'You have view + Actuals-import access. Editing is reserved for CFO members.'}
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '0.66rem', color: 'var(--t3)', opacity: 0.6 }}>
        {buildVersion}{buildDate && buildDate !== 'unknown' ? ` · ${new Date(buildDate).toUTCString().slice(0, 16)}` : ''}
      </div>
    </div>
  )
}
