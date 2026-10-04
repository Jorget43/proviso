'use client'

// Lives in its own client component because the EOFY page is a Server
// Component, and Server Components can't pass event handlers to DOM elements.
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ fontSize: '0.75rem', color: 'var(--t2)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
      className="no-print"
    >
      ⎙ Print / Save PDF
    </button>
  )
}
