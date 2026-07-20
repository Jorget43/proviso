'use client'
import { useEffect, useState } from 'react'

// Two independent notices, at most one shown at a time:
//   - "available"  an newer GitHub release exists (CFO-only, driven by the
//                  VersionCheck scheduler). Takes priority.
//   - "updated"    this deployment's version changed since last seen — a
//                  one-time post-update acknowledgement for any role.
const SEEN_KEY = 'proviso_seen_version'
const DISMISSED_UPDATE_KEY = 'proviso_dismissed_update'

type Mode = 'none' | 'available' | 'updated'

export default function UpdateBanner({
  currentVersion,
  latestVersion = null,
}: {
  currentVersion: string
  latestVersion?: string | null
}) {
  const [mode, setMode] = useState<Mode>('none')

  useEffect(() => {
    if (currentVersion === 'dev') return
    if (latestVersion) {
      if (localStorage.getItem(DISMISSED_UPDATE_KEY) !== latestVersion) {
        setMode('available')
        return
      }
    }
    if (localStorage.getItem(SEEN_KEY) !== currentVersion) setMode('updated')
  }, [currentVersion, latestVersion])

  function dismiss() {
    if (mode === 'available' && latestVersion) localStorage.setItem(DISMISSED_UPDATE_KEY, latestVersion)
    if (mode === 'updated') localStorage.setItem(SEEN_KEY, currentVersion)
    setMode('none')
  }

  if (mode === 'none') return null

  const available = mode === 'available'

  return (
    <div style={{
      background: available ? 'var(--amber-lt)' : 'var(--blue-lt)',
      borderBottom: '1px solid var(--border)',
      padding: '7px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: '0.8rem',
    }}>
      <span style={{ color: available ? 'var(--amber)' : 'var(--blue)', fontWeight: 600 }}>
        {available
          ? `Proviso ${latestVersion} is available — you're on ${currentVersion}`
          : `Proviso updated to ${currentVersion}`}
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss update notice"
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--t3)',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: '0 2px',
        }}
      >×</button>
    </div>
  )
}
