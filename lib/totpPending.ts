// In-memory store for users who have passed password auth but not yet TOTP.
// Each entry expires after 5 minutes. Safe for single-process Docker deployments.

import { randomBytes } from 'crypto'

const TTL_MS = 5 * 60 * 1000
const pending = new Map<string, { userId: number; expiresAt: number }>()

export function storePendingTotp(userId: number): string {
  const nonce = randomBytes(16).toString('hex')
  pending.set(nonce, { userId, expiresAt: Date.now() + TTL_MS })
  return nonce
}

export function consumePendingTotp(nonce: string): number | null {
  const entry = pending.get(nonce)
  if (!entry || Date.now() > entry.expiresAt) {
    pending.delete(nonce)
    return null
  }
  pending.delete(nonce)
  return entry.userId
}
