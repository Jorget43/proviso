// The code a device shows (as a QR code) so another device can join the
// household: the relay's address, the household id (for the new device's
// identity; the relay's own id comes from the key) and the household key.
// Holding it is holding the household, so it's only ever shown on screen,
// on request, and never stored or sent anywhere (docs/architecture.md, D4/D6).

import { toB64, fromB64, KEY_BYTES } from '@proviso/core/backup'
import { isHouseholdId, normaliseRelayUrl } from './relay'

export interface JoinInfo { relay: string; household: string; key: Uint8Array }

const PREFIX = 'proviso://join?'

const b64url = (b: Uint8Array) => toB64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => fromB64(s.replace(/-/g, '+').replace(/_/g, '/'))

export function joinCode(j: JoinInfo): string {
  return `${PREFIX}v=1&r=${encodeURIComponent(j.relay)}&h=${j.household}&k=${b64url(j.key)}`
}

/** Reads a join code (scanned or pasted). Null when it isn't one. */
export function parseJoinCode(input: string): JoinInfo | null {
  const s = input.trim()
  if (!s.startsWith(PREFIX)) return null
  const params = new Map(s.slice(PREFIX.length).split('&').map(p => {
    const i = p.indexOf('=')
    return [p.slice(0, i), p.slice(i + 1)] as const
  }))
  if (params.get('v') !== '1') return null
  let relay: string | null = null
  try { relay = normaliseRelayUrl(decodeURIComponent(params.get('r') ?? '')) } catch { return null }
  const household = params.get('h') ?? ''
  const key = fromB64url(params.get('k') ?? '')
  if (!relay || !isHouseholdId(household) || key.length !== KEY_BYTES) return null
  return { relay, household, key }
}
