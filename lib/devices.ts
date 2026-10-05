// Plain names for signed-in devices (Settings → Your devices), worked out from
// the browser's user-agent at sign-in. Deliberately rough — "Safari on iPhone"
// is enough to recognise your own phone; versions would only add noise.

import { prisma } from './db'
import { currentTokenHash } from './auth'

export interface DeviceRow {
  id:         number
  label:      string
  kind:       'web' | 'app'
  createdAt:  string
  lastUsedAt: string
  idleDays:   number   // whole days since it was last used
  current:    boolean
}

export function deviceLabel(userAgent: string | null, kind: string): string {
  const ua = userAgent ?? ''
  const os = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /CrOS/.test(ua) ? 'Chromebook'
    : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : null
  if (kind === 'app') return os ? `Proviso app on ${os}` : 'Proviso app'

  // Order matters: Edge and Opera also say "Chrome"; Chrome also says "Safari".
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? 'Unknown device'
}

export async function listDevices(userId: number): Promise<DeviceRow[]> {
  const [rows, current] = await Promise.all([
    prisma.session.findMany({
      where:   { userId, expiresAt: { gt: new Date() } },
      select:  { id: true, token: true, kind: true, userAgent: true, createdAt: true, lastUsedAt: true },
      orderBy: { lastUsedAt: 'desc' },
    }),
    currentTokenHash(),
  ])
  const now = Date.now()
  // The token hash stays on the server; the client only learns which row is "this device".
  return rows
    .map(r => ({
      id:         r.id,
      label:      deviceLabel(r.userAgent, r.kind),
      kind:       r.kind === 'app' ? 'app' as const : 'web' as const,
      createdAt:  r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt.toISOString(),
      idleDays:   Math.max(0, Math.floor((now - r.lastUsedAt.getTime()) / (24 * 60 * 60 * 1000))),
      current:    r.token === current,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current))
}
