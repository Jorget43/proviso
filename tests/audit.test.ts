import { describe, it, expect, vi, beforeEach } from 'vitest'

// The flush writes through lib/db — mocked so no test ever opens a database.
const createMany = vi.fn<(args: { data: unknown[] }) => Promise<{ count: number }>>(async () => ({ count: 0 }))
vi.mock('@/lib/db', () => ({ prisma: { auditEvent: { createMany } } }))

import { runWithAudit, setAuditActor, audit, recordWrite, describeWrite, summariseWrites } from '@/lib/audit'

const req = (ip = '203.0.113.7') => new Request('http://app/api/x', { method: 'POST', headers: { 'x-forwarded-for': `${ip}, 198.51.100.1` } })
const rows = () => createMany.mock.calls.flatMap(c => c[0].data) as Record<string, unknown>[]

beforeEach(() => createMany.mockClear())

describe('describeWrite', () => {
  it('records the record id and changed field names, never values', () => {
    const w = describeWrite('Expense', 'update', { where: { id: 12 }, data: { amount: 99.5, category: 'Food' } }, { id: 12, amount: 99.5 })
    expect(w).toEqual({ model: 'Expense', op: 'update', id: 12, fields: ['amount', 'category'], count: null })
    expect(JSON.stringify(w)).not.toContain('99.5')
  })

  it('names credential columns plainly', () => {
    expect(describeWrite('User', 'update', { where: { id: 3 }, data: { passwordHash: 'x', role: 'PARTNER' } }, { id: 3 }).fields)
      .toEqual(['password', 'role'])
  })

  it('takes the row count from bulk operations', () => {
    expect(describeWrite('Transaction', 'createMany', { data: [{}, {}] }, { count: 2 }).count).toBe(2)
  })
})

describe('summariseWrites', () => {
  it('collapses repeated writes to one line per operation and model', () => {
    const ws = [1, 2, 3].map(id => describeWrite('Expense', 'update', { where: { id }, data: { amount: 1 } }, { id }))
    expect(summariseWrites(ws)).toEqual([{ action: 'update Expense', target: '3 records', detail: 'amount' }])
  })

  it('keeps a single write addressable', () => {
    const ws = [describeWrite('Debt', 'delete', { where: { id: 4 } }, { id: 4 })]
    expect(summariseWrites(ws)).toEqual([{ action: 'delete Debt', target: '#4', detail: null }])
  })
})

describe('runWithAudit', () => {
  it('records writes against the authorised actor, with the client IP', async () => {
    await runWithAudit(req(), async () => {
      setAuditActor({ userId: 1, username: 'cfo' })
      recordWrite('MortgageSettings', 'update', { where: { id: 1 }, data: { rate: 6 } }, { id: 1 })
      return Response.json({ ok: true })
    })
    expect(rows()).toEqual([{ action: 'update MortgageSettings', target: '#1', detail: 'rate', userId: 1, username: 'cfo', ip: '203.0.113.7' }])
  })

  it('ignores writes with no actor (sign-in bookkeeping, schedulers)', async () => {
    await runWithAudit(req(), async () => {
      recordWrite('User', 'update', { where: { id: 1 }, data: { failedAttempts: 1 } }, { id: 1 })
      return Response.json({ ok: true })
    })
    expect(createMany).not.toHaveBeenCalled()
  })

  it('skips bookkeeping tables', async () => {
    await runWithAudit(req(), async () => {
      setAuditActor({ userId: 1, username: 'cfo' })
      recordWrite('Session', 'create', { data: {} }, { id: 9 })
      recordWrite('AuditEvent', 'createMany', { data: [] }, { count: 1 })
      return Response.json({ ok: true })
    })
    expect(createMany).not.toHaveBeenCalled()
  })

  it('ignores bulk writes that matched nothing', async () => {
    await runWithAudit(req(), async () => {
      setAuditActor({ userId: 1, username: 'cfo' })
      recordWrite('SuperHistory', 'updateMany', { where: { member: 'A' }, data: { member: 'B' } }, { count: 0 })
      return Response.json({ ok: true })
    })
    expect(createMany).not.toHaveBeenCalled()
  })

  it('drops writes from a failed request but keeps security events', async () => {
    await runWithAudit(req(), async () => {
      setAuditActor({ userId: 1, username: 'cfo' })
      recordWrite('Expense', 'create', { data: { amount: 1 } }, { id: 5 })
      audit({ action: 'auth.signin_failed', detail: 'unknown username' })
      return Response.json({ error: 'nope' }, { status: 400 })
    })
    expect(rows().map(r => r.action)).toEqual(['auth.signin_failed'])
  })

  it('keeps the context across awaits inside the handler', async () => {
    await runWithAudit(req(), async () => {
      await Promise.resolve()
      setAuditActor({ userId: 2, username: 'partner' })
      await new Promise(r => setTimeout(r, 1))
      recordWrite('Transaction', 'createMany', { data: [{}, {}, {}] }, { count: 3 })
      return Response.json({ ok: true })
    })
    expect(rows()).toEqual([expect.objectContaining({ action: 'create Transaction', target: '3 records', username: 'partner' })])
  })

  it('never fails the request when the log write fails', async () => {
    createMany.mockRejectedValueOnce(new Error('disk full'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await runWithAudit(req(), async () => { audit({ action: 'auth.signout' }); return Response.json({ ok: true }) })
    expect(res.status).toBe(200)
    err.mockRestore()
  })
})
