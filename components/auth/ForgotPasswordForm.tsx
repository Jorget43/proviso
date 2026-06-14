'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordForm() {
  const [username, setUsername] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    await fetch('/api/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username }),
    }).catch(() => {})
    setSubmitted(true)
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 360 }}>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {submitted ? (
            <>
              <div>
                <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.4rem', margin: '0 0 2px' }}>Check your email</h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--t2)', margin: 0, lineHeight: 1.6 }}>
                  If that account has an email address on file, a reset link has been sent.
                  If you don't have email set up, ask your CFO to relay the reset link.
                </p>
              </div>
              <Link href="/login" style={{ fontSize: '0.78rem', color: 'var(--blue)', textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.4rem', margin: '0 0 2px' }}>Forgot password</h1>
                <p style={{ fontSize: '0.76rem', color: 'var(--t3)', margin: 0 }}>
                  Enter your username and we'll send a reset link.
                </p>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>Username</span>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  style={inputStyle}
                />
              </label>
              <button type="submit" className="add-btn" disabled={busy} style={{ justifyContent: 'center' }}>
                {busy ? 'Sending…' : 'Send reset link'}
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
