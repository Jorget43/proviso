// The relay protocol (docs/architecture.md, D5) and the client devices use.
//
// A relay keeps, per household, an append-only list of envelopes, each
// given a sequence number as it arrives. Devices push what they changed and
// pull everything after the last sequence number they've seen. The relay
// never decrypts anything: it knows a random household id, the hash of an
// access key derived from the household key, and table names.
//
//   GET    /v1/health                                      → { ok, version }
//   POST   /v1/households/:id/envelopes  { envelopes }     → { last }
//   GET    /v1/households/:id/envelopes?since=N&limit=M    → { envelopes: [{ seq, ...Envelope }], last, more }
//   DELETE /v1/households/:id                              → 204
//
// Every household route takes `Authorization: Bearer <access key>`. The
// first push to an unknown household registers it with that key.

import type { Envelope } from './messages'

export const RELAY_API = 'v1'
export const MAX_ENVELOPES_PER_PUSH = 500
export const MAX_ENVELOPE_BYTES = 256 * 1024
export const PULL_LIMIT = 500

export interface StoredEnvelope extends Envelope { seq: number }
export interface PullResult { envelopes: StoredEnvelope[]; last: number; more: boolean }

export class RelayError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'RelayError' }
}

/** Household ids are UUIDs; anything else is refused before it reaches a path. */
export const isHouseholdId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)

/** A relay address as typed: https only, except a local relay while developing. Returns the tidied URL or null. */
export function normaliseRelayUrl(input: string): string | null {
  let s = input.trim()
  if (!s) return null
  if (!/^[a-z]+:\/\//i.test(s)) s = `https://${s}`
  const m = /^(https?):\/\/([^/?#\s]+)(\/[^?#\s]*)?$/i.exec(s)
  if (!m) return null
  const [, scheme, host, path = ''] = m
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)
  if (scheme.toLowerCase() === 'http' && !local) return null
  return `${scheme.toLowerCase()}://${host.toLowerCase()}${path.replace(/\/+$/, '')}`
}

// Only what's used of fetch, so this package needs no DOM types.
interface FetchResponse { ok: boolean; status: number; json(): Promise<unknown> }
export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<FetchResponse>

export interface RelayClient {
  health(): Promise<void>
  push(envelopes: Envelope[]): Promise<number>
  pull(since: number): Promise<PullResult>
  remove(): Promise<void>
}

export function relayClient(baseUrl: string, householdId: string, accessKey: string, fetchFn: FetchLike): RelayClient {
  if (!isHouseholdId(householdId)) throw new RelayError('Not a household id.')
  const base = `${baseUrl}/${RELAY_API}`
  const home = `${base}/households/${householdId}`
  const auth = { authorization: `Bearer ${accessKey}` }

  async function call(url: string, init: Parameters<FetchLike>[1] = {}): Promise<unknown> {
    let res: FetchResponse
    try {
      res = await fetchFn(url, init)
    } catch {
      throw new RelayError('Can’t reach the sync server. Check the address and that this device is online (and on Tailscale, if the server uses it).')
    }
    if (res.status === 204) return null
    const body = await res.json().catch(() => null) as { error?: string } | null
    if (!res.ok) {
      const why = res.status === 401 || res.status === 403
        ? 'The sync server didn’t accept this device’s key. This household may be registered there with a different key.'
        : body?.error ?? `The sync server answered with an error (${res.status}).`
      throw new RelayError(why, res.status)
    }
    return body
  }

  return {
    async health() {
      const body = await call(`${base}/health`) as { ok?: boolean } | null
      if (!body?.ok) throw new RelayError('That address answered, but it isn’t a Proviso sync server.')
    },
    async push(envelopes) {
      let last = 0
      for (let i = 0; i < envelopes.length; i += MAX_ENVELOPES_PER_PUSH) {
        const body = await call(`${home}/envelopes`, {
          method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify({ envelopes: envelopes.slice(i, i + MAX_ENVELOPES_PER_PUSH) }),
        }) as { last: number }
        last = body.last
      }
      return last
    },
    async pull(since) {
      return await call(`${home}/envelopes?since=${since}&limit=${PULL_LIMIT}`, { headers: auth }) as PullResult
    },
    async remove() {
      await call(home, { method: 'DELETE', headers: auth })
    },
  }
}
