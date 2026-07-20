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

  // Unknown/unexpected: log server-side, return an opaque 500 (no internals leaked).
  console.error('[api] unhandled error:', err)
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}

// Wrap a route handler with uniform error handling. Generic over the handler's
// exact argument list so it fits every Next 16 signature — `()`, `(req)`, and
// `(req, { params }: { params: Promise<{ id: string }> })` — without widening.
export function withErrors<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args)
    } catch (err) {
      return toErrorResponse(err)
    }
  }
}

// Read + validate a JSON body against a zod schema. Throws ApiError(400) on a
// malformed body or a validation failure (safe to use inside withErrors).
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new ApiError(400, 'Validation failed', result.error.flatten().fieldErrors)
  }
  return result.data
}
