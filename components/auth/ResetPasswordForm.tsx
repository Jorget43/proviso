'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordForm() {
  const params   = useSearchParams()
  const router   = useRouter()
  const token    = params.get('token') ?? ''
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [busy, setBusy]           = useState(false)
  const [done, setDone]           = useState(false)

  useEffect(() => {
    if (!token) setError('Invalid or missing reset token.')
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); setBusy(false); return }
      setDone(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch {
      setError('Network error')
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 360 }}>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {done ? (
            <div>
              <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.4rem', margin: '0 0 6px' }}>Password updated</h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--t2)', margin: 0 }}>Redirecting to sign in…</p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.4rem', margin: '0 0 2px' }}>Set new password</h1>
                <p style={{ fontSize: '0.76rem', color: 'var(--t3)', margin: 0 }}>Choose a new password for your account.</p>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>New password</span>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password" required minLength={8} style={inputStyle} />
                <span style={{ fontSize: '0.66rem', color: 'var(--t3)' }}>At least 8 characters.</span>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>Confirm password</span>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password" required style={inputStyle} />
              </label>

              {error && (
                <div style={{ fontSize: '0.74rem', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 5, padding: '7px 9px' }}>
                  {error}
                </div>
              )}

              <button type="submit" className="add-btn" disabled={busy || !token} style={{ justifyContent: 'center' }}>
                {busy ? 'Saving…' : 'Update password'}
              </button>
              <Link href="/login" style={{ fontSize: '0.72rem', color: 'var(--t3)', textAlign: 'center', textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '0.85rem',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--t1)',
}
