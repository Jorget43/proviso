export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { computeWatchdog, fyLabel, type WatchStatus } from '@/lib/watchdog'

// Internal developer tooling. Off by default in production — set
// WATCHDOG_ENABLED=true to expose it. Always on outside production. CFO-gated.
function watchdogEnabled(): boolean {
  return process.env.WATCHDOG_ENABLED === 'true' || process.env.NODE_ENV !== 'production'
}

const STATUS_STYLE: Record<WatchStatus, { bg: string; fg: string; label: string }> = {
  overdue: { bg: 'var(--red-lt)',   fg: 'var(--red)',   label: 'Overdue' },
  review:  { bg: 'var(--amber-lt)', fg: 'var(--amber)', label: 'Review' },
  current: { bg: 'var(--green-lt)', fg: 'var(--green)', label: 'Current' },
}

export default async function WatchdogPage() {
  const me = await requireSession()
  // Hide existence from anyone who shouldn't see it.
  if (me.role !== 'CFO' || !watchdogEnabled()) notFound()

  const report = computeWatchdog()
  const needsAttention = report.items.filter(i => i.status !== 'current')

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.6rem', fontWeight: 400, marginBottom: 4 }}>
        Assumptions watchdog
      </h1>
      <p style={{ fontSize: '0.8rem', color: 'var(--t2)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
        Internal tooling. Flags hard-coded ATO/super assumptions that are due for review against the
        current financial year (FY{fyLabel(report.currentFyEnding)}). It never auto-updates — confirm the
        value with the cited authority, edit the constant, then bump <code>calibratedFyEnding</code> in
        <code> lib/watchdog.ts</code>. As of {report.now}.
      </p>

      <div className="banner" style={{ marginBottom: '1.5rem' }}>
        <div className="b-item"><span className="b-label">Overdue</span><span className="b-value red">{report.counts.overdue}</span></div>
        <div className="b-item"><span className="b-label">Due for review</span><span className="b-value amber">{report.counts.review}</span></div>
        <div className="b-item"><span className="b-label">Current</span><span className="b-value green">{report.counts.current}</span></div>
        <div className="b-item"><span className="b-label">Tracked</span><span className="b-value">{report.items.length}</span></div>
      </div>

      {needsAttention.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--green)', marginBottom: '1.5rem' }}>
          ✓ All tracked assumptions are calibrated for the current financial year.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {report.items.map(item => {
          const s = STATUS_STYLE[item.status]
          return (
            <div key={item.id} style={{
              border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px',
              opacity: item.status === 'current' ? 0.72 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: s.fg, background: s.bg, borderRadius: 999, padding: '2px 9px',
                }}>{s.label}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {item.category} · {item.authority}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--t2)', marginBottom: 4 }}>{item.currentValue}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--t3)', lineHeight: 1.5 }}>{item.message}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: 6 }}>
                <code>{item.location}</code> · {item.reviewTrigger}
              </div>
              {item.notes && (
                <div style={{ fontSize: '0.7rem', color: 'var(--amber)', marginTop: 4 }}>⚠ {item.notes}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
