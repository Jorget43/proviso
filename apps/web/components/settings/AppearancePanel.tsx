'use client'
// Appearance: follow the device, or always light / dark. Saved to the
// signed-in user's account, so it follows them to any browser; applied at once
// by setting <html data-theme> (app/layout.tsx writes it on later page loads).

import { useState } from 'react'
import Panel from '@/components/ui/Panel'
import { THEME_CHOICES, type ThemeChoice } from '@/lib/theme'

const LABEL: Record<ThemeChoice, string> = { system: 'Match this device', light: 'Light', dark: 'Dark' }

function applyTheme(t: ThemeChoice) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}

export default function AppearancePanel({ initial }: { initial: ThemeChoice }) {
  const [theme, setTheme] = useState<ThemeChoice>(initial)
  const [error, setError] = useState<string | null>(null)

  async function choose(t: ThemeChoice) {
    const before = theme
    setTheme(t); setError(null)
    applyTheme(t)
    const res = await fetch('/api/auth/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: t }) }).catch(() => null)
    if (!res?.ok) {
      setTheme(before)
      applyTheme(before)
      setError('That didn’t save. Check the connection and try again.')
    }
  }

  return (
    <Panel title="Appearance" dotColor="var(--purple)">
      <p style={{ fontSize: '0.85rem', color: 'var(--t2)', lineHeight: 1.5 }}>Light or dark, for you on every device you sign in on. “Match this device” follows your phone’s or computer’s own setting.</p>
      <div className="seg" role="radiogroup" aria-label="Appearance" style={{ marginTop: '0.75rem' }}>
        {THEME_CHOICES.map(t => (
          <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? 'on' : undefined} onClick={() => void choose(t)}>
            {LABEL[t]}
          </button>
        ))}
      </div>
      {error && <p role="alert" style={{ color: 'var(--red)', marginTop: '0.5rem' }}>{error}</p>}
    </Panel>
  )
}
