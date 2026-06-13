'use client'
import { useState } from 'react'
import { buildPrompt } from '@/lib/watchdogEmail'
import type { AssumptionStatus } from '@/lib/watchdog'

export function TestNotifyButton() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send() {
    setState('sending')
    const res = await fetch('/api/admin/watchdog/test', { method: 'POST' })
    setState(res.ok ? 'sent' : 'error')
  }

  return (
    <button
      onClick={send}
      disabled={state === 'sending'}
      style={{
        fontSize: '0.78rem', padding: '6px 14px', borderRadius: 'var(--r)',
        background: state === 'sent' ? 'var(--green-lt)' : state === 'error' ? 'var(--red-lt)' : 'var(--surface2)',
        color: state === 'sent' ? 'var(--green)' : state === 'error' ? 'var(--red)' : 'var(--t2)',
        border: '1px solid var(--border)', cursor: state === 'sending' ? 'default' : 'pointer',
      }}
    >
      {state === 'idle'    && 'Send test notification'}
      {state === 'sending' && 'Sending…'}
      {state === 'sent'    && '✓ Sent — check Gmail'}
      {state === 'error'   && '✗ Failed — check RESEND_API_KEY'}
    </button>
  )
}

export function CopyPromptButton({ item, currentFyEnding }: { item: AssumptionStatus; currentFyEnding: number }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(buildPrompt(item, currentFyEnding))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      style={{
        fontSize: '0.68rem', padding: '3px 10px', borderRadius: 999,
        background: copied ? 'var(--green-lt)' : 'var(--surface2)',
        color: copied ? 'var(--green)' : 'var(--t3)',
        border: '1px solid var(--border)', cursor: 'pointer',
      }}
    >
      {copied ? '✓ Copied' : 'Copy AI prompt'}
    </button>
  )
}
