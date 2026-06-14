'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Panel from '@/components/ui/Panel'

interface PasskeyRow {
  id:         number
  name:       string
  deviceType: string
  backedUp:   boolean
  createdAt:  string
}

interface Props {
  initialPasskeys: PasskeyRow[]
}

export default function PasskeyPanel({ initialPasskeys }: Props) {
  const router = useRouter()
  const [passkeys, setPasskeys] = useState(initialPasskeys)
  const [adding, setAdding]     = useState(false)
  const [newName, setNewName]   = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const isHttps = typeof window !== 'undefined'
    && window.location.protocol !== 'https:'
    && window.location.hostname !== 'localhost'

  async function addPasskey(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { startRegistration, browserSupportsWebAuthn } = await import('@simplewebauthn/browser')
      if (!browserSupportsWebAuthn()) {
        setError('Your browser does not support passkeys.')
        setBusy(false)
        return
      }
      const optRes = await fetch('/api/auth/passkey/register-options', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newName }),
      })
      if (!optRes.ok) {
        const d = await optRes.json().catch(() => ({}))
        setError(d.error ?? 'Failed to start registration')
        setBusy(false)
        return
      }
      const optionsJSON = await optRes.json()
      const result = await startRegistration({ optionsJSON })
      const verRes = await fetch('/api/auth/passkey/register-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ result, name: newName }),
      })
      if (!verRes.ok) {
        const d = await verRes.json().catch(() => ({}))
        setError(d.error ?? 'Failed to register passkey')
        setBusy(false)
        return
      }
      const { passkey } = await verRes.json()
      setPasskeys(prev => [passkey, ...prev])
      setAdding(false)
      setNewName('')
      router.refresh()
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Passkey creation was cancelled.')
      } else {
        setError('Registration failed. Make sure you\'re accessing via HTTPS.')
      }
    }
    setBusy(false)
  }

  async function removePasskey(id: number) {
    const res = await fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPasskeys(prev => prev.filter(p => p.id !== id))
    }
  }

  return (
    <Panel title="Passkeys" dotColor="var(--purple)">
      <p style={{ fontSize: '0.78rem', color: 'var(--t2)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Sign in with your device fingerprint, face ID, or PIN instead of a password.
        Requires HTTPS — works with Tailscale Serve.
      </p>

      {isHttps && (
        <div style={{
          fontSize: '0.74rem', padding: '7px 10px', marginBottom: 12, borderRadius: 5,
          background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--amber) 25%, transparent)',
          color: 'var(--amber)',
        }}>
          Passkeys require HTTPS. Enable Tailscale Serve or access via localhost.
        </div>
      )}

      {passkeys.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, marginBottom: 12, overflow: 'hidden' }}>
          {passkeys.map((pk, i) => (
            <div key={pk.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderBottom: i < passkeys.length - 1 ? '1px solid var(--border)' : undefined,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{pk.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--t3)' }}>
                  {pk.deviceType === 'multiDevice' ? 'Synced passkey · ' : 'Device-bound · '}
                  Added {new Date(pk.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                className="hint-link"
                style={{ fontSize: '0.72rem', color: 'var(--red)', flexShrink: 0 }}
                onClick={() => removePasskey(pk.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <button className="add-btn" onClick={() => { setAdding(true); setError(null) }}>
          + Add passkey
        </button>
      ) : (
        <form onSubmit={addPasskey} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>Passkey name</span>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
              autoFocus
              placeholder='e.g. "iPhone" or "MacBook"'
              style={inp}
            />
          </label>
          {error && <ErrorBox message={error} />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="add-btn" disabled={busy}>
              {busy ? 'Confirm on your device…' : 'Continue'}
            </button>
            <button
              type="button"
              className="hint-link"
              onClick={() => { setAdding(false); setError(null); setNewName('') }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Panel>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 9px', fontSize: '0.82rem',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--t1)',
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      fontSize: '0.74rem', color: 'var(--red)',
      background: 'color-mix(in srgb, var(--red) 10%, transparent)',
      border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)',
      borderRadius: 5, padding: '7px 9px',
    }}>
      {message}
    </div>
  )
}
