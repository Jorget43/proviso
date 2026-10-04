// In-memory rate limiter for the login endpoint.
// Tracks request counts per IP in a rolling 60-second window.
// Safe for single-process Docker deployments; resets on container restart.

const WINDOW_MS = 60_000
const MAX_REQUESTS = 20

interface Entry {
  count:     number
  windowStart: number
}

const store = new Map<string, Entry>()

export function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now })
    return false
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) return true
  return false
}
