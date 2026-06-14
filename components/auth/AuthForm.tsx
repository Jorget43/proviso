'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Step = 'credentials' | 'totp' | 'passkey'

interface Props {
  mode: 'login' | 'setup'
}

export default function AuthForm({ mode }: Props) {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [nonce, setNonce]       = useState<string | null>(null)
  const [step, setStep]         = useState<Step>('credentials')
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  const isSetup = mode === 'setup'

  async function signInWithPasskey() {
    setError(null)
    setBusy(true)
    try {
      const { startAuthentication, browserSupportsWebAuthn } = await import('@simplewebauthn/browser')
      if (!browserSupportsWebAuthn()) {
        setError('Your browser does not support passkeys.')
        setBusy(false)
        return
      }
      const optRes = await fetch('/api/auth/passkey/auth-options', { method: 'POST' })
      if (!optRes.ok) {
        setError('Could not start passkey login')
        setBusy(false)
        return
      }
      const optionsJSON = await optRes.json()
      const result = await startAuthentication({ optionsJSON })
      const verRes = await fetch('/api/auth/passkey/auth-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(result),
      })
      if (!verRes.ok) {
        const d = await verRes.json().catch(() => ({}))
        setError(d.error ?? 'Passkey verification failed')
        setBusy(false)
        return
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Passkey sign-in was cancelled.')
      } else {
        setError('Passkey sign-in failed. Make sure you\'re on HTTPS.')
      }
      setBusy(false)
    }
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(isSetup ? '/api/auth/setup' : '/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(isSetup ? { name, username, password } : { username, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setBusy(false)
        return
      }
      if (data.requiresTOTP) {
        setNonce(data.nonce)
        setStep('totp')
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

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/totp-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nonce, code: totpCode, isRecovery: useRecovery }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Invalid code')
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

  if (step === 'totp') {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <form onSubmit={submitTotp} className="panel" style={{ width: '100%', maxWidth: 360 }}>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.4rem', margin: '0 0 2px' }}>Two-factor auth</h1>
              <p style={{ fontSize: '0.76rem', color: 'var(--t3)', margin: 0 }}>
                {useRecovery ? 'Enter one of your recovery codes.' : 'Enter the 6-digit code from your authenticator app.'}
              </p>
            </div>

            <Field label={useRecovery ? 'Recovery code' : 'Authenticator code'}>
              <input
                value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode={useRecovery ? 'text' : 'numeric'}
                maxLength={useRecovery ? 20 : 6}
                required
                autoFocus
                style={inputStyle}
              />
            </Field>

            {error && <ErrorBox message={error} />}

            <button type="submit" className="add-btn" disabled={busy} style={{ justifyContent: 'center' }}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>

            <button
              type="button"
              className="hint-link"
              style={{ fontSize: '0.72rem', textAlign: 'center' }}
              onClick={() => { setUseRecovery(v => !v); setTotpCode(''); setError(null) }}
            >
              {useRecovery ? 'Use authenticator app instead' : 'Use a recovery code instead'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submitCredentials} className="panel" style={{ width: '100%', maxWidth: 360 }}>
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

          {error && <ErrorBox message={error} />}

          <button type="submit" className="add-btn" disabled={busy} style={{ justifyContent: 'center' }}>
            {busy ? 'Please wait…' : isSetup ? 'Create account' : 'Sign in'}
          </button>

          {!isSetup && (
            <Link href="/forgot-password" style={{ fontSize: '0.72rem', color: 'var(--t3)', textAlign: 'center', textDecoration: 'none' }}>
              Forgot password?
            </Link>
          )}

          {!isSetup && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: '0.66rem', color: 'var(--t3)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <button
                type="button"
                onClick={signInWithPasskey}
                disabled={busy}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: '0.82rem',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--t2)', cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {busy ? 'Please wait…' : 'Sign in with passkey'}
              </button>
            </>
          )}
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

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ fontSize: '0.74rem', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)',
      border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 5, padding: '7px 9px' }}>
      {message}
    </div>
  )
}
