'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Panel from '@/components/ui/Panel'

export interface Member {
  id:          number
  name:        string
  username:    string
  role:        string
  email?:      string | null
  totpSecret?: string | null
  allowance?:  { amount: number; dayOfWeek: number } | null
}

const ASSIGNABLE_ROLES = ['CFO', 'PARTNER', 'CHILD']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MembersPanel({ users, currentUserId }: { users: Member[]; currentUserId: number }) {
  const router = useRouter()
  const [error, setError]   = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editEmailId, setEditEmailId]         = useState<number | null>(null)
  const [editEmailVal, setEditEmailVal]       = useState('')
  const [editAllowanceId, setEditAllowanceId] = useState<number | null>(null)
  const [allowanceAmt, setAllowanceAmt]       = useState('')
  const [allowanceDow, setAllowanceDow]       = useState(5)

  const [name, setName]               = useState('')
  const [username, setUsername]       = useState('')
  const [password, setPassword]       = useState('')
  const [email, setEmail]             = useState('')
  const [role, setRole]               = useState('PARTNER')
  const [newAllowanceAmt, setNewAllowanceAmt] = useState('')

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
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password, role }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong')
      return
    }
    const newUser = await res.json()
    if (role === 'CHILD' && newAllowanceAmt) {
      await fetch('/api/allowance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newUser.id, amount: Number(newAllowanceAmt), dayOfWeek: 5 }),
      })
    }
    setName(''); setUsername(''); setPassword(''); setEmail(''); setRole('PARTNER'); setNewAllowanceAmt(''); setAdding(false)
    router.refresh()
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

  async function saveEmail(id: number) {
    if (await call(`/api/users/${id}`, 'PUT', { email: editEmailVal })) {
      setEditEmailId(null)
    }
  }

  async function saveAllowance(userId: number) {
    if (await call('/api/allowance', 'PUT', { userId, amount: Number(allowanceAmt), dayOfWeek: allowanceDow })) {
      setEditAllowanceId(null)
    }
  }

  async function removeMember(id: number, who: string) {
    if (!confirm(`Remove ${who}? This deletes their login.`)) return
    await call(`/api/users/${id}`, 'DELETE')
  }

  return (
    <Panel title="Household members" dotColor="var(--blue)">
      <p style={{ fontSize: '0.72rem', color: 'var(--t3)', margin: '0 0 12px', lineHeight: 1.5 }}>
        CFOs have full access. Partners can view everything and import Actuals. Children see only their Pocket Money tab.
      </p>

      {error && (
        <div style={{ fontSize: '0.74rem', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 5, padding: '7px 9px', marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {users.map(u => (
          <div key={u.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {u.name}{u.id === currentUserId && <span style={{ color: 'var(--t3)', fontWeight: 400 }}> (you)</span>}
                  {u.totpSecret && (
                    <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4,
                      background: 'color-mix(in srgb, var(--green) 15%, transparent)',
                      color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)' }}>
                      2FA
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--t3)' }}>@{u.username}</div>
              </div>
              <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} style={{ ...sel, width: 110 }}>
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                {!ASSIGNABLE_ROLES.includes(u.role) && <option value={u.role}>{u.role}</option>}
              </select>
              <button className="hint-link" style={{ fontSize: '0.7rem' }} onClick={() => resetPassword(u.id)}>Reset pw</button>
              {u.id !== currentUserId && (
                <button className="del-btn" onClick={() => removeMember(u.id, u.name)} aria-label="Remove member">&#215;</button>
              )}
            </div>

            {/* Email row */}
            {editEmailId === u.id ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  value={editEmailVal}
                  onChange={e => setEditEmailVal(e.target.value)}
                  type="email"
                  placeholder="email@example.com"
                  style={{ ...inp, flex: 1 }}
                />
                <button className="add-btn" style={{ fontSize: '0.72rem' }} onClick={() => saveEmail(u.id)}>Save</button>
                <button className="hint-link" style={{ fontSize: '0.72rem' }} onClick={() => setEditEmailId(null)}>Cancel</button>
              </div>
            ) : (
              <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {u.email
                  ? <span>{u.email}</span>
                  : <span style={{ fontStyle: 'italic' }}>No email — password reset requires CFO relay</span>}
                <button className="hint-link" style={{ fontSize: '0.68rem' }} onClick={() => { setEditEmailId(u.id); setEditEmailVal(u.email ?? '') }}>
                  {u.email ? 'Edit' : 'Add email'}
                </button>
              </div>
            )}

            {/* Allowance row — CHILD members only */}
            {u.role === 'CHILD' && (
              editAllowanceId === u.id ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>$</span>
                  <input
                    value={allowanceAmt}
                    onChange={e => setAllowanceAmt(e.target.value)}
                    type="number"
                    min="0"
                    step="0.50"
                    placeholder="Weekly amount"
                    style={{ ...inp, width: 130 }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>on</span>
                  <select value={allowanceDow} onChange={e => setAllowanceDow(Number(e.target.value))} style={sel}>
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <button className="add-btn" style={{ fontSize: '0.72rem' }} onClick={() => saveAllowance(u.id)}>Save</button>
                  <button className="hint-link" style={{ fontSize: '0.72rem' }} onClick={() => setEditAllowanceId(null)}>Cancel</button>
                </div>
              ) : (
                <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {u.allowance
                    ? <span>Allowance: ${u.allowance.amount}/week on {DAY_NAMES[u.allowance.dayOfWeek]}s</span>
                    : <span style={{ fontStyle: 'italic' }}>No allowance set</span>}
                  <button className="hint-link" style={{ fontSize: '0.68rem' }} onClick={() => {
                    setEditAllowanceId(u.id)
                    setAllowanceAmt(u.allowance ? String(u.allowance.amount) : '')
                    setAllowanceDow(u.allowance?.dayOfWeek ?? 5)
                  }}>
                    {u.allowance ? 'Edit' : 'Set allowance'}
                  </button>
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <form onSubmit={addMember} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required style={inp} />
          <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" required style={inp} />
          <input placeholder="Password (min 8)" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required style={inp} />
          <input placeholder="Email (optional — for password reset)" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
          <select value={role} onChange={e => setRole(e.target.value)} style={sel}>
            {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {role === 'CHILD' && (
            <input
              placeholder="Weekly allowance amount (optional)"
              type="number"
              min="0"
              step="0.50"
              value={newAllowanceAmt}
              onChange={e => setNewAllowanceAmt(e.target.value)}
              style={inp}
            />
          )}
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

const sel: React.CSSProperties = {
  padding: '6px 9px', fontSize: '0.82rem',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--t1)',
}
