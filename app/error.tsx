'use client'

// Catches page-level render errors. The root layout (TopNav etc.) still renders.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 440, textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠</div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--t1, #f1f5f9)' }}>
          This page couldn't load
        </h2>
        <p style={{ color: 'var(--t3, #94a3b8)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          If this keeps happening, the database may be unavailable.
          Check <code style={{ fontSize: '0.8rem' }}>docker logs proviso --tail 50</code> for details.
        </p>
        <button
          onClick={reset}
          style={{ background: 'var(--blue, #2563eb)', color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 1.1rem', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}
