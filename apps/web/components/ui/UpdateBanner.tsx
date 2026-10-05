'use client'
import { useState, useSyncExternalStore } from 'react'

// Two independent notices, at most one shown at a time:
//   - "available"  an newer GitHub release exists (CFO-only, driven by the
//                  VersionCheck scheduler). Takes priority.
//   - "updated"    this deployment's version changed since last seen — a
//                  one-time post-update acknowledgement for any role.
const SEEN_KEY = 'proviso_seen_version'
const DISMISSED_UPDATE_KEY = 'proviso_dismissed_update'

type Mode = 'none' | 'available' | 'updated'

const SEP = '\n'

function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

// A primitive snapshot, so React can compare it between renders.
function readStored(): string {
  try {
    return `${localStorage.getItem(DISMISSED_UPDATE_KEY) ?? ''}${SEP}${localStorage.getItem(SEEN_KEY) ?? ''}`
  } catch {
    return SEP
  }
}

export default function UpdateBanner({
  currentVersion,
  latestVersion = null,
}: {
  currentVersion: string
  latestVersion?: string | null
}) {
  // localStorage is an external store: read it with useSyncExternalStore (the
  // server snapshot is null, so nothing renders until the browser has it).
  const stored = useSyncExternalStore(subscribeStorage, readStored, () => null)
  const [dismissedNow, setDismissedNow] = useState(false)

  let mode: Mode = 'none'
  if (stored !== null && !dismissedNow && currentVersion !== 'dev') {
    const [dismissedUpdate, seen] = stored.split(SEP)
    if (latestVersion && dismissedUpdate !== latestVersion) mode = 'available'
    else if (seen !== currentVersion) mode = 'updated'
  }

  function dismiss() {
    try {
      if (mode === 'available' && latestVersion) localStorage.setItem(DISMISSED_UPDATE_KEY, latestVersion)
      if (mode === 'updated') localStorage.setItem(SEEN_KEY, currentVersion)
    } catch { /* storage unavailable — dismiss for this page view only */ }
    setDismissedNow(true)
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
