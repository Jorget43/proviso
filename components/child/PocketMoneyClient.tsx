'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Tx { id: number; amount: number; description: string; date: string; category: string }
interface Schedule { amount: number; dayOfWeek: number }

interface Props {
  name:     string
  balance:  number
  schedule: Schedule | null
  txs:      Tx[]
}

function fmt(n: number) {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2)
}

export default function PocketMoneyClient({ name, balance, schedule, txs: initialTxs }: Props) {
  const router = useRouter()
  const [txs, setTxs]       = useState(initialTxs)
  const [bal, setBal]       = useState(balance)
  const [adding, setAdding] = useState(false)
  const [desc, setDesc]     = useState('')
  const [amt, setAmt]       = useState('')
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [error, setError]   = useState<string | null>(null)

  async function addSpend(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amount = -Math.abs(Number(amt))
    const res = await fetch('/api/pocket-money', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, description: desc, date }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong')
      return
    }
    const { tx } = await res.json()
    setTxs(prev => [tx, ...prev])
    setBal(prev => prev + tx.amount)
    setDesc(''); setAmt(''); setDate(new Date().toISOString().slice(0, 10))
    setAdding(false)
    router.refresh()
  }

  const balanceColor = bal >= 0 ? 'var(--green)' : 'var(--red)'

  return (
    <div className="page" style={{ maxWidth: 540 }}>
      <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.6rem', fontWeight: 400, marginBottom: '0.25rem' }}>
        Pocket money
      </h1>
      <p style={{ fontSize: '0.8rem', color: 'var(--t3)', marginBottom: '1.5rem' }}>{name}</p>

      {/* Balance card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
        padding: '1.5rem', marginBottom: '1.25rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
          Balance
        </div>
        <div style={{ fontSize: '2.8rem', fontWeight: 600, color: balanceColor, fontVariantNumeric: 'tabular-nums' }}>
          {fmt(bal)}
        </div>
        {schedule && (
          <div style={{ fontSize: '0.75rem', color: 'var(--t3)', marginTop: '0.5rem' }}>
            {fmt(schedule.amount)}/week · paid on {DAY_NAMES[schedule.dayOfWeek]}s
          </div>
        )}
      </div>

      {/* Add spend */}
      {!adding ? (
        <button className="add-btn" style={{ marginBottom: '1.25rem' }} onClick={() => setAdding(true)}>
          + Record a spend
        </button>
      ) : (
        <form onSubmit={addSpend} style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
          padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {error && (
            <div style={{ fontSize: '0.74rem', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 5, padding: '6px 9px' }}>
              {error}
            </div>
          )}
          <input placeholder="What did you buy?" value={desc} onChange={e => setDesc(e.target.value)} required style={inp} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span className="input-prefix">$</span>
              <input
                placeholder="0.00"
                type="number"
                min="0.01"
                step="0.01"
                value={amt}
                onChange={e => setAmt(e.target.value)}
                required
                style={{ ...inp, paddingLeft: 28 }}
              />
            </div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ ...inp, width: 'auto' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="add-btn">Save spend</button>
            <button type="button" className="hint-link" onClick={() => { setAdding(false); setError(null) }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Transaction list */}
      {txs.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--t3)', textAlign: 'center', padding: '2rem 0' }}>
          No transactions yet.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
          {txs.map((tx, i) => {
            const running = txs.slice(i).reduce((s, t) => s + t.amount, 0)
            return (
              <div
                key={tx.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: '0 12px',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderBottom: i < txs.length - 1 ? '1px solid var(--border)' : undefined,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{tx.description}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)' }}>{tx.date}</div>
                </div>
                <div style={{
                  fontSize: '0.88rem', fontWeight: 600,
                  color: tx.amount >= 0 ? 'var(--green)' : 'var(--red)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--t3)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(running)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {txs.length > 0 && (
        <div style={{ fontSize: '0.68rem', color: 'var(--t3)', textAlign: 'right', marginTop: '0.5rem' }}>
          Amount · Running balance
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 9px', fontSize: '0.82rem',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--t1)',
}
