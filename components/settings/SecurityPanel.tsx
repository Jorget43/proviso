'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Panel from '@/components/ui/Panel'
import Image from 'next/image'

interface Props {
  hasTOTP: boolean
}

type EnrollStep = 'idle' | 'scan' | 'verify' | 'codes' | 'disabling'

export default function SecurityPanel({ hasTOTP }: Props) {
  const router = useRouter()
  const [step, setStep]       = useState<EnrollStep>('idle')
  const [qr, setQr]           = useState<string | null>(null)
  const [secret, setSecret]   = useState<string | null>(null)
  const [code, setCode]       = useState('')
  const [codes, setCodes]     = useState<string[]>([])
  const [disablePassword, setDisablePassword] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [busy, setBusy]       = useState(false)

  async function startEnroll() {
    setBusy(true); setError(null)
    const res = await fetch('/api/auth/totp')
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to start setup'); setBusy(false); return }
    setQr(data.qr); setSecret(data.secret); setStep('scan'); setBusy(false)
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await fetch('/api/auth/totp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ secret, code }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Invalid code'); setBusy(false); return }
    setCodes(data.recoveryCodes); setStep('codes'); setBusy(false)
    router.refresh()
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await fetch('/api/auth/totp', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: disablePassword }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to disable'); setBusy(false); return }
    setStep('idle'); setDisablePassword(''); setBusy(false)
    router.refresh()
  }

  return (
    <Panel title="Security" dotColor="var(--amber)">
      {!hasTOTP && step === 'idle' && (
        <>
          <p style={{ fontSize: '0.78rem', color: 'var(--t2)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Two-factor authentication adds a second layer of security to your account.
            After signing in with your password, you'll be asked for a code from your authenticator app.
          </p>
          {error && <ErrorBox message={error} />}
          <button className="add-btn" disabled={busy} onClick={startEnroll}>
            {busy ? 'Setting up…' : 'Enable 2FA'}
          </button>
        </>
      )}

      {step === 'scan' && qr && (
        <>
          <p style={{ fontSize: '0.78rem', color: 'var(--t2)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.),
            then enter the 6-digit code below to confirm.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 16px' }}>
            <Image src={qr} alt="TOTP QR code" width={180} height={180} unoptimized />
          </div>
          <details style={{ marginBottom: 12 }}>
            <summary style={{ fontSize: '0.72rem', color: 'var(--t3)', cursor: 'pointer' }}>Can't scan? Enter manually</summary>
            <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', background: 'var(--surface2)',
              border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px', marginTop: 6,
              wordBreak: 'break-all', color: 'var(--t2)' }}>
              {secret}
            </div>
          </details>
          <form onSubmit={confirmEnroll} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>Verification code</span>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" maxLength={6}
                autoComplete="one-time-code" required autoFocus style={inp} />
            </label>
            {error && <ErrorBox message={error} />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="add-btn" disabled={busy}>{busy ? 'Verifying…' : 'Confirm'}</button>
              <button type="button" className="hint-link" onClick={() => { setStep('idle'); setError(null) }}>Cancel</button>
            </div>
          </form>
        </>
      )}

      {step === 'codes' && (
        <>
          <div style={{ background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)', borderRadius: 6,
            padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>
              Save your recovery codes
            </div>
            <p style={{ fontSize: '0.73rem', color: 'var(--t2)', margin: 0, lineHeight: 1.5 }}>
              These codes can each be used once if you lose access to your authenticator app.
              Store them somewhere safe — they won't be shown again.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
            {codes.map(c => (
              <div key={c} style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'var(--surface2)',
                border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', color: 'var(--t1)' }}>
                {c}
              </div>
            ))}
          </div>
          <button className="add-btn" onClick={() => setStep('idle')}>Done</button>
        </>
      )}

      {hasTOTP && step === 'idle' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--green)' }}>2FA is enabled</span>
            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4,
              background: 'color-mix(in srgb, var(--green) 15%, transparent)',
              color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)' }}>
              Active
            </span>
          </div>
          {step === 'idle' && (
            <button className="hint-link" style={{ fontSize: '0.76rem', color: 'var(--red)' }}
              onClick={() => setStep('disabling')}>
              Disable 2FA
            </button>
          )}
        </>
      )}

      {step === 'disabling' && (
        <form onSubmit={disable} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: '0.76rem', color: 'var(--t2)', margin: 0 }}>
            Enter your current password to confirm.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>Password</span>
            <input type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)}
              autoComplete="current-password" required autoFocus style={inp} />
          </label>
          {error && <ErrorBox message={error} />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="hint-link" style={{ color: 'var(--red)' }} disabled={busy}>
              {busy ? 'Disabling…' : 'Confirm disable'}
            </button>
            <button type="button" className="hint-link" onClick={() => { setStep('idle'); setError(null) }}>Cancel</button>
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
    <div style={{ fontSize: '0.74rem', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)',
      border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 5, padding: '7px 9px' }}>
      {message}
    </div>
  )
}
