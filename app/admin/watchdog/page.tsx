export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { computeWatchdog, fyLabel, type WatchStatus } from '@/lib/watchdog'
import { prisma } from '@/lib/db'
import { TestNotifyButton, CopyPromptButton } from '@/components/admin/WatchdogActions'

function watchdogEnabled(): boolean {
  // Strictly developer-only. Never falls back to NODE_ENV so end-user deployments
  // never see this page, regardless of environment.
  return process.env.WATCHDOG_ENABLED === 'true'
}

const STATUS_STYLE: Record<WatchStatus, { bg: string; fg: string; label: string }> = {
  overdue: { bg: 'var(--red-lt)',   fg: 'var(--red)',   label: 'Overdue' },
  review:  { bg: 'var(--amber-lt)', fg: 'var(--amber)', label: 'Review' },
  current: { bg: 'var(--green-lt)', fg: 'var(--green)', label: 'Current' },
}

function nextMonday(): string {
  const d = new Date()
  const daysUntil = (1 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntil)
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default async function WatchdogPage() {
  const me = await requireSession()
  if (me.role !== 'CFO' || !watchdogEnabled()) notFound()

  const [report, lastSnapshot] = await Promise.all([
    Promise.resolve(computeWatchdog()),
    prisma.watchdogSnapshot.findFirst({ orderBy: { takenAt: 'desc' } }),
  ])
  const needsAttention = report.items.filter(i => i.status !== 'current')

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.6rem', fontWeight: 400, margin: 0 }}>
            Assumptions watchdog
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--t3)', margin: '4px 0 0' }}>
            {lastSnapshot
              ? `Last checked ${new Date(lastSnapshot.takenAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}${lastSnapshot.emailSentAt ? ' · email sent' : ''} · next check ${nextMonday()}`
              : `No scheduled check run yet · next check ${nextMonday()}`
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>FY{fyLabel(report.currentFyEnding)} · {report.now}</span>
          <TestNotifyButton />
        </div>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--t2)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
        Internal tooling. Flags hard-coded ATO/super assumptions due for review. Runs automatically every Monday 08:00 AEST when <code>WATCHDOG_ENABLED=true</code>. When an item is stale, use <strong>Copy AI prompt</strong> to get a ready-to-paste Claude.ai / Gemini query for the exact code change needed.
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: s.fg, background: s.bg, borderRadius: 999, padding: '2px 9px', flexShrink: 0,
                }}>{s.label}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                  {item.category} · {item.authority}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--t2)', marginBottom: 4 }}>{item.currentValue}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--t3)', lineHeight: 1.5 }}>{item.message}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <code>{item.location}</code>
                <span>·</span>
                <span>{item.reviewTrigger}</span>
                {item.authorityUrl && (
                  <>
                    <span>·</span>
                    <a href={item.authorityUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontSize: '0.7rem' }}>
                      {item.authority} ↗
                    </a>
                  </>
                )}
              </div>
              {item.notes && (
                <div style={{ fontSize: '0.7rem', color: 'var(--amber)', marginTop: 4 }}>⚠ {item.notes}</div>
              )}
              {item.status !== 'current' && (
                <div style={{ marginTop: 8 }}>
                  <CopyPromptButton item={item} currentFyEnding={report.currentFyEnding} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
