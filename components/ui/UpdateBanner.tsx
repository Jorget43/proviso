'use client'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'proviso_seen_version'

export default function UpdateBanner({ currentVersion }: { currentVersion: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (currentVersion === 'dev') return
    if (localStorage.getItem(STORAGE_KEY) !== currentVersion) setShow(true)
  }, [currentVersion])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, currentVersion)
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      background: 'var(--blue-lt)',
      borderBottom: '1px solid var(--border)',
      padding: '7px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: '0.8rem',
    }}>
      <span style={{ color: 'var(--blue)', fontWeight: 600 }}>
        Proviso updated to {currentVersion}
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
