// Audit log (Phase 21) — who did what, when.
//
// Two sources feed it:
//   - Data writes, captured automatically. withErrors() opens a per-request
//     context; authorize() names the actor in it; the Prisma extension in
//     lib/db.ts reports every create/update/delete. Only writes made by an
//     authorised request are recorded — schedulers and sign-in bookkeeping
//     (failedAttempts etc.) are not.
//   - Security events, recorded explicitly with audit() in the auth routes
//     (sign-ins, failures, lockouts, password/2FA/passkey changes).
//
// Entries are buffered and written once the handler has finished. That's not
// just tidiness: Prisma runs on a single SQLite connection, so an insert from
// inside a $transaction would wait on the transaction that's waiting on it.
//
// What's stored: model, record id and the *names* of changed fields — never
// values. The log is for "who changed the mortgage settings on Tuesday", not a
// second copy of the household's figures.

import { AsyncLocalStorage } from 'node:async_hooks'

export interface AuditActor { userId: number; username: string }

export interface AuditEntry {
  action:    string
  target?:   string | null
  detail?:   string | null
  userId?:   number | null
  username?: string | null
}

export interface Write { model: string; op: string; id: number | string | null; fields: string[]; count: number | null }

interface AuditContext {
  actor?:  AuditActor
  ip:      string | null
  events:  AuditEntry[]
  writes:  Write[]
}

const als = new AsyncLocalStorage<AuditContext>()

const RETENTION_DAYS = 365

// Bookkeeping tables whose writes aren't user actions (or are covered by an
// explicit security event instead).
const SKIP_MODELS = new Set(['AuditEvent', 'Session', 'WebAuthnChallenge', 'PasswordReset', 'VersionCheck', 'WatchdogSnapshot'])
const WRITE_OPS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'])
// Credential columns are named plainly ("password changed"), never by column.
const FIELD_LABELS: Record<string, string> = { passwordHash: 'password', totpSecret: '2FA', totpRecoveryCodes: '2FA recovery codes' }

export function clientIp(req: unknown): string | null {
  if (!(req instanceof Request)) return null
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip')) || null
}

// Run a route handler inside an audit context, then write what it recorded.
// Data writes are kept only when the handler succeeded (status < 400): a
// failed request's writes were rolled back or never meant to stick. Explicit
// events (e.g. a failed sign-in, which returns 401) are always kept.
export async function runWithAudit(req: unknown, fn: () => Promise<Response>): Promise<Response> {
  const ctx: AuditContext = { ip: clientIp(req), events: [], writes: [] }
  let res: Response | undefined
  try {
    res = await als.run(ctx, fn)
    return res
  } finally {
    const ok = res !== undefined && res.status < 400
    await flush(ctx, ok)
  }
}

export function setAuditActor(actor: AuditActor): void {
  const ctx = als.getStore()
  if (ctx) ctx.actor = actor
}

// Record a security event. Outside a request context (shouldn't happen for
// the auth routes, all wrapped in withErrors) it's written straight away.
export function audit(entry: AuditEntry): void {
  const ctx = als.getStore()
  if (ctx) { ctx.events.push(entry); return }
  void persist([{ ...entry, ip: null }])
}

// Called by the Prisma extension after each successful operation.
export function recordWrite(model: string | undefined, op: string, args: unknown, result: unknown): void {
  if (!model || !WRITE_OPS.has(op) || SKIP_MODELS.has(model)) return
  const ctx = als.getStore()
  if (!ctx?.actor) return
  const w = describeWrite(model, op, args, result)
  if (w.count === 0) return // a bulk update/delete that matched nothing
  ctx.writes.push(w)
}

export function describeWrite(model: string, op: string, args: unknown, result: unknown): Write {
  const a = (args ?? {}) as { data?: unknown; create?: unknown; update?: unknown; where?: { id?: unknown } }
  const r = result as { id?: unknown; count?: unknown } | null
  const data = op === 'upsert' ? { ...(a.create as object), ...(a.update as object) } : a.data
  const fields = data && typeof data === 'object' && !Array.isArray(data)
    ? Object.keys(data).filter(f => f !== 'id').map(f => FIELD_LABELS[f] ?? f)
    : []
  const rawId = r?.id ?? a.where?.id
  const id = typeof rawId === 'number' || typeof rawId === 'string' ? rawId : null
  const count = typeof r?.count === 'number' ? r.count : null
  return { model, op, id, fields, count }
}

// One entry per (operation, model) per request — a save that touches twenty
// expense rows reads as one line, not twenty.
export function summariseWrites(writes: Write[]): AuditEntry[] {
  const groups = new Map<string, Write[]>()
  for (const w of writes) {
    const key = `${verb(w.op)} ${w.model}`
    groups.set(key, [...(groups.get(key) ?? []), w])
  }
  return [...groups.entries()].map(([action, ws]) => {
    const rows = ws.reduce((n, w) => n + (w.count ?? 1), 0)
    const ids = ws.map(w => w.id).filter(id => id !== null)
    const target = ws.length === 1 && ids.length === 1 ? `#${ids[0]}`
      : rows === 1 ? null
      : `${rows} records`
    const fields = [...new Set(ws.flatMap(w => w.fields))]
    return { action, target, detail: fields.length ? fields.join(', ') : null }
  })
}

function verb(op: string): string {
  if (op.startsWith('create')) return 'create'
  if (op.startsWith('delete')) return 'delete'
  if (op === 'upsert') return 'save'
  return 'update'
}

async function flush(ctx: AuditContext, keepWrites: boolean): Promise<void> {
  const writes = keepWrites ? summariseWrites(ctx.writes) : []
  const rows = [...ctx.events, ...writes].map(e => ({
    action:   e.action,
    target:   e.target ?? null,
    detail:   e.detail ?? null,
    userId:   e.userId !== undefined ? e.userId : ctx.actor?.userId ?? null,
    username: e.username !== undefined ? e.username : ctx.actor?.username ?? null,
    ip:       ctx.ip,
  }))
  if (rows.length) await persist(rows)
}

async function persist(rows: (AuditEntry & { ip: string | null })[]): Promise<void> {
  try {
    // Lazy import: lib/db imports this module for recordWrite.
    const { prisma } = await import('./db')
    await prisma.auditEvent.createMany({
      data: rows.map(r => ({
        action: r.action, target: r.target ?? null, detail: r.detail ?? null,
        userId: r.userId ?? null, username: r.username ?? null, ip: r.ip,
      })),
    })
  } catch (err) {
    // Never fail the user's request over the log.
    console.error('[audit] failed to write audit events:', err)
  }
}

// Housekeeping, run on sign-in alongside the expired-session sweep.
export async function pruneAuditLog(): Promise<void> {
  const { prisma } = await import('./db')
  await prisma.auditEvent.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
  })
}
