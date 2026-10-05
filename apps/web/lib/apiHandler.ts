// Uniform API route error handling + input validation (Phase 14).
//
// Two pieces, adoptable incrementally:
//   - withErrors(fn)      wraps a route handler so any thrown error becomes a
//                         consistent { error } JSON envelope with a sane status,
//                         instead of Next's default unhandled 500.
//   - parseBody(req, s)   reads + zod-validates the JSON body before it reaches
//                         Prisma, throwing ApiError(400) with field details on
//                         failure.
//
// Auth gates (authorize / requireAdultRead) still return their Response directly
// — those are normal returns, not thrown, so they pass through untouched.

import { Prisma } from '@prisma/client'
import type { ZodType } from 'zod'
import { isBusyError } from './dbErrors'
import { runWithAudit } from './audit'

// Thrown to short-circuit a handler with a specific status + client message.
export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { error: err.message, ...(err.details ? { details: err.details } : {}) },
      { status: err.status },
    )
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025: record required by the operation was not found (update/delete miss).
    if (err.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 })
    // P2002: unique constraint violation.
    if (err.code === 'P2002') return Response.json({ error: 'Already exists' }, { status: 409 })
    // P2003: foreign key constraint failed.
    if (err.code === 'P2003') return Response.json({ error: 'Invalid reference' }, { status: 400 })
  }

  // Backstop for a raw SQLITE_BUSY/"database is locked" error reaching here
  // directly — e.g. lock contention at $transaction's own BEGIN, which
  // lib/db.ts's retry extension can't intercept since it only wraps
  // individual model operations, not the transaction's control frames.
  if (isBusyError(err)) {
    return Response.json({ error: 'Database is busy, please try again' }, { status: 503 })
  }

  // Unknown/unexpected: log server-side, return an opaque 500 (no internals leaked).
  console.error('[api] unhandled error:', err)
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}

// Wrap a route handler with uniform error handling. Generic over the handler's
// exact argument list so it fits every Next 16 signature — `()`, `(req)`, and
// `(req, { params }: { params: Promise<{ id: string }> })` — without widening.
// Also opens the request's audit context (lib/audit.ts).
export function withErrors<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => runWithAudit(args[0], async () => {
    try {
      return await fn(...args)
    } catch (err) {
      return toErrorResponse(err)
    }
  })
}

// Read + validate a JSON body against a zod schema. Throws ApiError(400) on a
// malformed body or a validation failure (safe to use inside withErrors).
// `message` replaces the generic "Validation failed" — for screens that show
// the error text directly (e.g. the sign-in forms).
export async function parseBody<T>(req: Request, schema: ZodType<T>, message?: string): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, message ?? 'Invalid JSON body')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    if (message) throw new ApiError(400, message)
    const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[] | undefined>
    // The message is shown to the user (SaveErrorToast, inline form errors),
    // so phrase it in plain language. `details` keeps the raw per-field list.
    const problems = Object.entries(fieldErrors)
      .flatMap(([field, msgs]) => (msgs ?? []).slice(0, 1).map(m => describeProblem(field, m)))
    const summary =
      problems.length === 1 ? problems[0]
      : problems.length > 1 ? `Some values aren’t valid: ${problems.join('; ')}`
      : 'Validation failed'
    throw new ApiError(400, summary, fieldErrors)
  }
  return result.data
}

// "daysPerWeek" → "Days per week", "person1Name" → "Person 1 name", "amt" → "Amount".
function fieldLabel(field: string): string {
  const special: Record<string, string> = { amt: 'Amount', cat: 'Category', abn: 'ABN', fte: 'FTE' }
  if (special[field]) return special[field]
  const words = field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Rewrite zod's default wording; keep custom schema messages as they are.
function describeProblem(field: string, msg: string): string {
  const label = fieldLabel(field)
  let m: RegExpMatchArray | null
  if ((m = msg.match(/^Too small: expected number to be >=?\s*(\S+)/))) return `${label} must be at least ${m[1]}`
  if ((m = msg.match(/^Too big: expected number to be <=?\s*(\S+)/))) return `${label} must be at most ${m[1]}`
  if (/^Too small: expected string to have >=?\s*1 characters?/.test(msg)) return `${label} can’t be empty`
  if ((m = msg.match(/^Too big: expected string to have <=?\s*(\d+) characters/))) return `${label} must be at most ${m[1]} characters`
  if (/^Invalid input: expected \w+, received undefined/.test(msg)) return `${label} is required`
  if (/^Invalid input: expected (number|string|boolean)/.test(msg)) return `${label} has the wrong type`
  if (/^Invalid option/.test(msg)) return `${label} isn’t one of the allowed values`
  if (/^Invalid email/i.test(msg)) return `${label} isn’t a valid email address`
  return `${label}: ${msg}`
}
