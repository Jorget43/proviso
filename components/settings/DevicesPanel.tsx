'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Panel from '@/components/ui/Panel'
import type { DeviceRow } from '@/lib/devices'

// Settings → Your devices: where you're signed in, with a way to sign a lost
// or shared device out.

function lastActive(days: number): string {
  if (days <= 0) return 'active today'
  if (days === 1) return 'active yesterday'
  return `active ${days} days ago`
}

export default function DevicesPanel({ initialDevices }: { initialDevices: DeviceRow[] }) {
  const router = useRouter()
  const [devices, setDevices] = useState(initialDevices)
  const [busy, setBusy]       = useState<number | 'others' | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const others = devices.filter(d => !d.current)

  async function signOut(target: number | 'others') {
    setBusy(target)
    setError(null)
    const res = await fetch(target === 'others' ? '/api/auth/sessions' : `/api/auth/sessions/${target}`, { method: 'DELETE' }).catch(() => null)
    setBusy(null)
    if (!res?.ok) { setError('Couldn’t sign that device out. Please try again.'); return }
    setDevices(prev => target === 'others' ? prev.filter(d => d.current) : prev.filter(d => d.id !== target))
    router.refresh()
  }

  return (
    <Panel title="Your devices" dotColor="var(--blue)">
      <p className="devices-intro">
        Where you&rsquo;re signed in. If a phone is lost or you used a shared computer, sign it out here.
      </p>

      <ul className="devices-list">
        {devices.map(d => (
          <li key={d.id} className="devices-row">
            <div className="devices-main">
              <span className="devices-name">
                {d.label}
                {d.current && <span className="devices-this">This device</span>}
              </span>
              <span className="devices-sub">
                Signed in {new Date(d.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} · {d.current ? 'active now' : lastActive(d.idleDays)}
              </span>
            </div>
            {!d.current && (
              <button className="btn devices-out" disabled={busy !== null} onClick={() => signOut(d.id)}>
                {busy === d.id ? 'Signing out…' : 'Sign out'}
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="devices-error" role="alert">{error}</p>}

      {others.length > 1 && (
        <button className="btn devices-all" disabled={busy !== null} onClick={() => signOut('others')}>
          {busy === 'others' ? 'Signing out…' : `Sign out all ${others.length} other devices`}
        </button>
      )}
      {others.length === 0 && <p className="devices-note">You&rsquo;re not signed in anywhere else.</p>}
    </Panel>
  )
}
