'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Panel from '@/components/ui/Panel'

export interface Member {
  id:       number
  name:     string
  username: string
  role:     string
}

const ASSIGNABLE_ROLES = ['CFO', 'PARTNER'] // CHILD deferred

export default function MembersPanel({ users, currentUserId }: { users: Member[]; currentUserId: number }) {
  const router = useRouter()
  const [error, setError]   = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName]         = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('PARTNER')

  async function call(url: string, method: string, body?: object): Promise<boolean> {
    setError(null)
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body:    body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong')
      return false
    }
    router.refresh()
    return true
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (await call('/api/users', 'POST', { name, username, password, role })) {
      setName(''); setUsername(''); setPassword(''); setRole('PARTNER'); setAdding(false)
    }
  }

  async function changeRole(id: number, newRole: string) {
    await call(`/api/users/${id}`, 'PUT', { role: newRole })
  }

  async function resetPassword(id: number) {
    const pw = prompt('New password (min 8 characters):')
    if (pw === null) return
    if (pw.length < 8) { setError('Password must be at least 8 characters'); return }
    await call(`/api/users/${id}`, 'PUT', { password: pw })
  }

  async function removeMember(id: number, who: string) {
    if (!confirm(`Remove ${who}? This deletes their login.`)) return
    await call(`/api/users/${id}`, 'DELETE')
  }

  return (
    <Panel title="Household members" dotColor="var(--blue)">
      <p style={{ fontSize: '0.72rem', color: 'var(--t3)', margin: '0 0 12px', lineHeight: 1.5 }}>
        CFOs have full access. Partners can view everything and import Actuals, but can&apos;t edit budget,
        debts, super, or settings.
      </p>

      {error && (
        <div style={{ fontSize: '0.74rem', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 5, padding: '7px 9px', marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.map(u => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                {u.name}{u.id === currentUserId && <span style={{ color: 'var(--t3)', fontWeight: 400 }}> (you)</span>}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--t3)' }}>@{u.username}</div>
            </div>
            <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className="nav-select" style={{ width: 110 }}>
              {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              {!ASSIGNABLE_ROLES.includes(u.role) && <option value={u.role}>{u.role}</option>}
            </select>
            <button className="hint-link" style={{ fontSize: '0.7rem' }} onClick={() => resetPassword(u.id)}>Reset pw</button>
            {u.id !== currentUserId && (
              <button className="del-btn" onClick={() => removeMember(u.id, u.name)} aria-label="Remove member">&#215;</button>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <form onSubmit={addMember} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required style={inp} />
          <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" required style={inp} />
          <input placeholder="Password (min 8)" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required style={inp} />
          <select value={role} onChange={e => setRole(e.target.value)} className="nav-select">
            {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="add-btn">Add member</button>
            <button type="button" className="hint-link" onClick={() => { setAdding(false); setError(null) }}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="add-btn mt1" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>+ Add member</button>
      )}
    </Panel>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 9px', fontSize: '0.82rem',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--t1)',
}
