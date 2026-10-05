export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdult } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Activity log (Phase 21) — the audit trail from lib/audit.ts. CFO only.

const PAGE_SIZE = 200

const LABELS: Record<string, string> = {
  'auth.signin':          'Signed in',
  'auth.signin_failed':   'Sign-in failed',
  'auth.locked':          'Account locked',
  'auth.signout':         'Signed out',
  'auth.setup':           'First-run setup',
  'auth.reset_requested': 'Password reset requested',
  'auth.reset':           'Password reset',
  'auth.2fa_on':          '2FA turned on',
  'auth.2fa_off':         '2FA turned off',
  'auth.2fa_off_failed':  '2FA turn-off refused',
  'auth.passkey_added':   'Passkey added',
  'auth.passkey_removed': 'Passkey removed',
  'auth.sessions_revoked': 'Device signed out',
}
const WARN = new Set(['auth.signin_failed', 'auth.locked', 'auth.2fa_off_failed'])

// "update MortgageSettings" → "Updated mortgage settings"
function describe(action: string): string {
  if (LABELS[action]) return LABELS[action]
  const [verb, model] = action.split(' ')
  if (!model) return action
  const past = { create: 'Added', update: 'Updated', delete: 'Deleted', save: 'Saved' }[verb] ?? verb
  const noun = model.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2').toLowerCase()
  return `${past} ${noun}`
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ show?: string; before?: string }> }) {
  const me = await requireAdult()
  if (me.role !== 'CFO') notFound()

  const { show, before } = await searchParams
  const securityOnly = show === 'security'
  const beforeId = Number(before) > 0 ? Number(before) : undefined

  const events = await prisma.auditEvent.findMany({
    where: {
      ...(securityOnly ? { action: { startsWith: 'auth.' } } : {}),
      ...(beforeId ? { id: { lt: beforeId } } : {}),
    },
    orderBy: { id: 'desc' },
    take: PAGE_SIZE,
  })
  const older = events.length === PAGE_SIZE ? events[events.length - 1].id : null
  const q = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams()
    if (securityOnly) p.set('show', 'security')
    for (const [k, v] of Object.entries(extra)) if (v !== undefined) p.set(k, String(v))
    const s = p.toString()
    return `/settings/activity${s ? `?${s}` : ''}`
  }

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <Link href="/settings" className="hint-link" style={{ fontSize: '0.78rem' }}>← Settings</Link>
          <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.6rem', fontWeight: 400, margin: '4px 0 0' }}>Activity log</h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--t2)', margin: '4px 0 0', lineHeight: 1.5, maxWidth: 620 }}>
            Sign-ins, security changes and every change to household data — who, when and from where. Records which fields changed, not their values. Kept for a year.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, fontSize: '0.78rem' }}>
          <Link href="/settings/activity" className="hint-link" style={{ fontWeight: securityOnly ? 400 : 600 }}>All</Link>
          <span style={{ color: 'var(--t3)' }}>·</span>
          <Link href="/settings/activity?show=security" className="hint-link" style={{ fontWeight: securityOnly ? 600 : 400 }}>Security only</Link>
        </div>
      </div>

      {events.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--t2)' }}>Nothing recorded yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="txn-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>When</th><th>Who</th><th>What</th><th>Detail</th><th>From</th></tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--t2)' }}>
                    {e.createdAt.toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>{e.username ?? <span style={{ color: 'var(--t3)' }}>—</span>}</td>
                  <td style={{ color: WARN.has(e.action) ? 'var(--red)' : undefined, whiteSpace: 'nowrap' }}>
                    {describe(e.action)}{e.target ? <span style={{ color: 'var(--t3)' }}> {e.target}</span> : null}
                  </td>
                  <td style={{ color: 'var(--t2)', fontSize: '0.74rem' }}>{e.detail}</td>
                  <td style={{ color: 'var(--t3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{e.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: '1rem', fontSize: '0.78rem' }}>
        {beforeId && <Link href={q({})} className="hint-link">← Newest</Link>}
        {older && <Link href={q({ before: older })} className="hint-link">Older →</Link>}
      </div>
    </div>
  )
}
