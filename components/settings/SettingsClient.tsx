'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

interface Props {
  person1Name:          string
  person2Name:          string
  partnerEnabled:       boolean
  jorgeFTE:             number
  graceFTE:             number
  mortgageBalance:      number
  superBalance:         number
  partnerSuperBalance:  number
  parentalLeaveEnabled: boolean
}

export default function SettingsClient({
  person1Name, person2Name, partnerEnabled,
  jorgeFTE, graceFTE, mortgageBalance,
  superBalance, partnerSuperBalance,
  parentalLeaveEnabled,
}: Props) {
  const router   = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

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
          <div className="da-row"><span className="da-label">Person 1</span><span>{person1Name}</span></div>
          <div className="da-row"><span className="da-label">Person 2</span><span>{partnerEnabled ? person2Name : '—'}</span></div>
          <div className="da-row"><span className="da-label">{person1Name} income</span><span>{fmt(jorgeFTE)}/yr</span></div>
          {partnerEnabled && <div className="da-row"><span className="da-label">{person2Name} income</span><span>{fmt(graceFTE)}/yr</span></div>}
          <div className="da-row"><span className="da-label">Mortgage balance</span><span>{mortgageBalance > 0 ? fmt(mortgageBalance) : '—'}</span></div>
          <div className="da-row"><span className="da-label">{person1Name} super</span><span>{fmt(superBalance)}</span></div>
          {partnerEnabled && <div className="da-row"><span className="da-label">{person2Name} super</span><span>{fmt(partnerSuperBalance)}</span></div>}
          <div className="da-row"><span className="da-label">Parental leave</span><span>{parentalLeaveEnabled ? 'Enabled' : 'Disabled'}</span></div>
        </div>
      </Panel>

      <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
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

      <div style={{ marginTop: '1.25rem', fontSize: '0.72rem', color: 'var(--t3)' }}>
        To edit individual figures (incomes, expenses, super balances, debts) use the relevant tab above.
      </div>
    </div>
  )
}
