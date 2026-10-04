'use client'

// Catches errors thrown by the root layout (e.g. database unavailable).
// Must include <html>/<body> because the normal layout didn't render.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f1117', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: 480, padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#f1f5f9' }}>
            Proviso can't reach the database
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            The database file may be corrupted or the container is out of disk space.
          </p>
          <div style={{ background: '#1e2535', border: '1px solid #334155', borderRadius: 8, padding: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
            <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnose</p>
            <code style={{ display: 'block', fontSize: '0.8rem', color: '#7dd3fc', lineHeight: 1.8, userSelect: 'all' }}>
              {'docker logs proviso --tail 50'}<br />
              {'docker exec proviso sh -c "df -h /data && ls -la /data"'}
            </code>
          </div>
          <div style={{ background: '#1e2535', border: '1px solid #334155', borderRadius: 8, padding: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
            <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>After fixing disk / restoring backup</p>
            <code style={{ display: 'block', fontSize: '0.8rem', color: '#7dd3fc', lineHeight: 1.8, userSelect: 'all' }}>
              {'docker compose restart proviso'}
            </code>
          </div>
          <button
            onClick={reset}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.25rem', fontSize: '0.9rem', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  )
}
