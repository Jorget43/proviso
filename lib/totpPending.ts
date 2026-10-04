// In-memory store for users who have passed password auth but not yet TOTP.
// Each entry expires after 5 minutes. Safe for single-process Docker deployments.
//
// A wrong code doesn't burn the entry — the user can retry (a mistyped digit
// shouldn't force re-entering the password) — but only MAX_ATTEMPTS times, so
// the nonce can't be used to brute-force the 6-digit code.

import { randomBytes } from 'crypto'

const TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5
const pending = new Map<string, { userId: number; expiresAt: number; attempts: number }>()

export function storePendingTotp(userId: number): string {
  const nonce = randomBytes(16).toString('hex')
  pending.set(nonce, { userId, expiresAt: Date.now() + TTL_MS, attempts: 0 })
  return nonce
}

// Returns the pending user without consuming the entry, or null if the nonce
// is unknown/expired.
export function getPendingTotp(nonce: string): number | null {
  const entry = pending.get(nonce)
  if (!entry || Date.now() > entry.expiresAt) {
    pending.delete(nonce)
    return null
  }
  return entry.userId
}

// Records a wrong code. Returns true while the user may still retry; false
// once attempts are exhausted (the entry is then dropped).
export function recordFailedTotp(nonce: string): boolean {
  const entry = pending.get(nonce)
  if (!entry) return false
  entry.attempts++
  if (entry.attempts >= MAX_ATTEMPTS) {
    pending.delete(nonce)
    return false
  }
  return true
}

// Call on success — the nonce is single-use.
export function consumePendingTotp(nonce: string): void {
  pending.delete(nonce)
}
