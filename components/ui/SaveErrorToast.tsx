'use client'
import { useEffect, useState } from 'react'

// Surfaces failed saves.
//
// The app updates the screen optimistically and then calls the API, and most
// call sites never looked at the response — so a rejected save (validation
// error, expired session, no permission, busy database) looked successful
// until the next reload silently reverted it. Rather than relying on every
// call site to check, this wraps window.fetch once and reports any failed
// same-origin mutation (POST/PUT/PATCH/DELETE to /api/…) here.
//
// Opt-outs: /api/auth/* (the auth forms show their own errors), and any
// request sending the header `X-Handles-Errors: 1` because its screen
// already displays the failure inline.

interface Failure { message: string; count: number }

const PATCHED = Symbol.for('proviso.fetchPatched')
const EVENT = 'proviso:save-failed'

function messageFor(status: number, serverError: unknown): string {
  if (status === 0) return 'Network error — the server couldn’t be reached.'
  if (status === 401) return 'Your session has expired. Sign in again to keep editing.'
  if (status === 403) return 'You don’t have permission to change this.'
  if (status === 404) return 'That item no longer exists — it may have been deleted elsewhere.'
  if (status === 409) return 'That already exists.'
  if (status === 503) return 'The database is busy. Wait a moment and try again.'
  if (status === 400 || status === 422) {
    return typeof serverError === 'string' && serverError !== 'Validation failed'
      ? serverError
      : 'Some of the values entered aren’t valid.'
  }
  return 'The server hit an error.'
}

function isTrackedMutation(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (method === 'GET' || method === 'HEAD') return false
  const raw = input instanceof Request ? input.url : String(input)
  const url = new URL(raw, window.location.href)
  if (url.origin !== window.location.origin) return false
  if (!url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/auth/')) return false
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  return headers.get('X-Handles-Errors') !== '1'
}

function installFetchWatcher() {
  const w = window as unknown as Record<symbol, boolean>
  if (w[PATCHED]) return
  w[PATCHED] = true
  const original = window.fetch.bind(window)
  const report = (message: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: message }))

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const tracked = isTrackedMutation(input, init)
    try {
      const res = await original(input, init)
      if (tracked && !res.ok) {
        const body = await res.clone().json().catch(() => ({}))
        report(messageFor(res.status, (body as { error?: unknown }).error))
      }
      return res
    } catch (err) {
      if (tracked) report(messageFor(0, null))
      throw err
    }
  }
}

export default function SaveErrorToast() {
  const [failure, setFailure] = useState<Failure | null>(null)

  useEffect(() => {
    installFetchWatcher()
    const onFail = (e: Event) => {
      const message = (e as CustomEvent<string>).detail
      setFailure(f => (f && f.message === message ? { message, count: f.count + 1 } : { message, count: 1 }))
    }
    window.addEventListener(EVENT, onFail)
    return () => window.removeEventListener(EVENT, onFail)
  }, [])

  if (!failure) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 1000,
        maxWidth: 'min(560px, calc(100vw - 32px))', width: 'max-content',
        background: 'var(--surface)', color: 'var(--t1)',
        border: '1px solid var(--red)', borderLeft: '4px solid var(--red)', borderRadius: 'var(--r)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)', padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8rem',
      }}
    >
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        <strong style={{ color: 'var(--red)' }}>
          Not saved{failure.count > 1 ? ` (${failure.count}×)` : ''}.
        </strong>{' '}
        {failure.message} The screen may show a change that wasn’t kept.
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', fontSize: '0.76rem', whiteSpace: 'nowrap' }}
      >
        Reload
      </button>
      <button
        onClick={() => setFailure(null)}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}
