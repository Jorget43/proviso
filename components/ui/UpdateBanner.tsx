'use client'
import { useState } from 'react'

export default function UpdateBanner({ latestTag, currentVersion }: {
  latestTag: string
  currentVersion: string
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div style={{
      background: 'var(--blue-lt)',
      borderBottom: '1px solid var(--border)',
      padding: '7px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: '0.8rem',
      flexWrap: 'wrap',
    }}>
      <span style={{ color: 'var(--blue)', fontWeight: 600 }}>
        Proviso {latestTag} available
      </span>
      <span style={{ color: 'var(--t2)' }}>
        (current: {currentVersion})
      </span>
      <span style={{ color: 'var(--t3)' }}>·</span>
      <code style={{
        fontSize: '0.76rem',
        color: 'var(--t1)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '1px 7px',
        userSelect: 'all',
      }}>
        docker compose pull && docker compose up -d
      </code>
      <button
        onClick={() => setDismissed(true)}
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
          flexShrink: 0,
        }}
      >×</button>
    </div>
  )
}
