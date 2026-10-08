// The relay's HTTP API (protocol: packages/sync/src/relay.ts). Plain
// node:http — no framework, no dependencies at run time.

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http'
import type { Envelope } from '@proviso/sync/messages'
import { RELAY_API, MAX_ENVELOPES_PER_PUSH, MAX_ENVELOPE_BYTES, PULL_LIMIT, isHouseholdId } from '@proviso/sync/relay'
import { Store } from './store'

const MAX_BODY_BYTES = MAX_ENVELOPES_PER_PUSH * (MAX_ENVELOPE_BYTES + 1024)
const TABLE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/
const B64 = /^[A-Za-z0-9+/]*={0,2}$/

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status
  if (body === undefined) { res.end(); return }
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Too much in one push.')
    chunks.push(chunk as Buffer)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new HttpError(400, 'Not JSON.') }
}

function validEnvelopes(body: unknown): Envelope[] {
  const list = (body as { envelopes?: unknown })?.envelopes
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_ENVELOPES_PER_PUSH) throw new HttpError(400, `Send 1 to ${MAX_ENVELOPES_PER_PUSH} envelopes.`)
  return list.map(x => {
    const e = x as Partial<Envelope>
    const ok = Number.isInteger(e.v) && Number.isInteger(e.schema) && typeof e.table === 'string' && TABLE.test(e.table)
      && typeof e.nonce === 'string' && e.nonce.length <= 24 && B64.test(e.nonce)
      && typeof e.data === 'string' && e.data.length <= MAX_ENVELOPE_BYTES && B64.test(e.data)
    if (!ok) throw new HttpError(400, 'An envelope is malformed.')
    return { v: e.v!, schema: e.schema!, table: e.table!, nonce: e.nonce!, data: e.data! }
  })
}

export interface RelayOptions { dataFile: string; version?: string; log?: (line: string) => void }

export function createRelay({ dataFile, version = 'dev', log = () => {} }: RelayOptions): { server: Server; store: Store } {
  const store = new Store(dataFile)

  const server = createServer(async (req, res) => {
    // Bearer tokens, no cookies: any origin may call (the web client may be served from elsewhere).
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'authorization, content-type')
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('cache-control', 'no-store')
    res.setHeader('x-content-type-options', 'nosniff')
    if (req.method === 'OPTIONS') return send(res, 204)

    const url = new URL(req.url ?? '/', 'http://relay')
    const parts = url.pathname.split('/').filter(Boolean)
    try {
      if (parts[0] !== RELAY_API) throw new HttpError(404, 'Not found.')
      if (parts.length === 2 && parts[1] === 'health' && req.method === 'GET') return send(res, 200, { ok: true, version })

      if (parts[1] !== 'households' || !parts[2] || !isHouseholdId(parts[2])) throw new HttpError(404, 'Not found.')
      const household = parts[2]
      const bearer = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization ?? '')?.[1]
      if (!bearer) throw new HttpError(401, 'Missing access key.')
      const access = store.access(household, bearer)
      if (access === 'denied') throw new HttpError(403, 'Wrong access key.')

      if (parts.length === 4 && parts[3] === 'envelopes' && req.method === 'POST') {
        const envelopes = validEnvelopes(await readJson(req))
        const last = store.append(household, bearer, envelopes)
        log(`push ${household.slice(0, 8)}… +${envelopes.length} → ${last}`)
        return send(res, 200, { last })
      }
      if (parts.length === 4 && parts[3] === 'envelopes' && req.method === 'GET') {
        if (access === 'unknown') return send(res, 200, { envelopes: [], last: 0, more: false })
        const since = Math.max(0, Number(url.searchParams.get('since') ?? 0) || 0)
        const limit = Math.min(PULL_LIMIT, Math.max(1, Number(url.searchParams.get('limit') ?? PULL_LIMIT) || PULL_LIMIT))
        return send(res, 200, store.pull(household, since, limit))
      }
      if (parts.length === 3 && req.method === 'DELETE') {
        if (access === 'ok') store.remove(household)
        log(`delete ${household.slice(0, 8)}…`)
        return send(res, 204)
      }
      throw new HttpError(404, 'Not found.')
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message })
      log(`error ${(err as Error).message}`)
      return send(res, 500, { error: 'The sync server had a problem. Try again shortly.' })
    }
  })

  server.on('close', () => store.close())
  return { server, store }
}
