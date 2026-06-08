'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  mode: 'login' | 'setup'
}

export default function AuthForm({ mode }: Props) {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  const isSetup = mode === 'setup'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(isSetup ? '/api/auth/setup' : '/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(isSetup ? { name, username, password } : { username, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong')
        setBusy(false)
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Network error')
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} className="panel" style={{ width: '100%', maxWidth: 360 }}>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.4rem', margin: '0 0 2px' }}>
              {isSetup ? 'Welcome to Proviso' : 'Sign in'}
            </h1>
            <p style={{ fontSize: '0.76rem', color: 'var(--t3)', margin: 0 }}>
              {isSetup ? 'Create your CFO account to get started.' : 'Enter your household credentials.'}
            </p>
          </div>

          {isSetup && (
            <Field label="Your name">
              <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required style={inputStyle} />
            </Field>
          )}

          <Field label="Username">
            <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required style={inputStyle} />
          </Field>

          <Field label="Password">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete={isSetup ? 'new-password' : 'current-password'} required minLength={isSetup ? 8 : undefined} style={inputStyle} />
            {isSetup && <p style={{ fontSize: '0.66rem', color: 'var(--t3)', margin: '3px 0 0' }}>At least 8 characters.</p>}
          </Field>

          {error && (
            <div style={{ fontSize: '0.74rem', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 5, padding: '7px 9px' }}>
              {error}
            </div>
          )}

          <button type="submit" className="add-btn" disabled={busy} style={{ justifyContent: 'center' }}>
            {busy ? 'Please wait…' : isSetup ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '0.85rem',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--t1)',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>{label}</span>
      {children}
    </label>
  )
}
