import cron from 'node-cron'
import { prisma } from './db'

// The repo publishes versions as git tags (CI builds an image per `v*` tag),
// not GitHub Releases — /releases/latest 404s — so read the tag list.
const TAGS_URL = 'https://api.github.com/repos/Jorget43/proviso/tags?per_page=100'

export async function checkAndStoreLatestVersion(): Promise<void> {
  try {
    const res = await fetch(TAGS_URL, {
      headers: { 'User-Agent': 'proviso-version-check/1.0' },
    })
    if (!res.ok) return
    const data = await res.json() as unknown
    if (!Array.isArray(data)) return
    const tag = latestReleaseTag(data.map(t => (t as { name?: unknown })?.name).filter((n): n is string => typeof n === 'string'))
    if (!tag) return
    await prisma.versionCheck.upsert({
      where: { id: 1 },
      create: { id: 1, latestTag: tag },
      update: { latestTag: tag, checkedAt: new Date() },
    })
  } catch {
    // Network failure or GitHub down — don't crash startup
  }
}

export async function getLatestVersion(): Promise<{ latestTag: string; checkedAt: Date } | null> {
  try {
    return await prisma.versionCheck.findUnique({ where: { id: 1 } })
  } catch {
    return null
  }
}

// Parses `v1.6.0` or a `git describe` build like `v1.6.0-2-gabc1234` into its
// numeric core; null for anything else (e.g. a bare commit sha).
function parseVersion(v: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

// Highest plain `vX.Y.Z` tag, compared numerically (the API's order isn't
// semver order: v1.10.0 vs v1.9.0). Pre-release/suffixed tags are ignored.
export function latestReleaseTag(names: string[]): string | null {
  let best: { name: string; v: number[] } | null = null
  for (const name of names) {
    if (!/^v?\d+\.\d+\.\d+$/.test(name.trim())) continue
    const v = parseVersion(name)!
    if (!best || compareVersions(v, best.v) > 0) best = { name: name.trim(), v }
  }
  return best?.name ?? null
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

// True only when `latest` is a strictly newer release than `current`. A
// master build ahead of the last tag (`v1.6.0-2-g…`) shares that tag's core
// and is *newer* than it, so it must not be told to "update" to v1.6.0.
export function isUpdateAvailable(current: string, latest: string): boolean {
  if (!current || current === 'dev' || !latest) return false
  const cur = parseVersion(current)
  const lat = parseVersion(latest)
  if (!cur || !lat) return false
  return compareVersions(lat, cur) > 0
}

let schedulerStarted = false

export function startVersionCheckScheduler(): void {
  // Run immediately on startup so the banner is populated from the first request
  checkAndStoreLatestVersion().catch(console.error)

  if (schedulerStarted) return
  schedulerStarted = true

  // Refresh daily at 09:00 AEST
  cron.schedule('0 9 * * *', () => {
    checkAndStoreLatestVersion().catch(console.error)
  }, { timezone: 'Australia/Sydney' })

  console.log('[version-check] scheduler running — fires daily 09:00 AEST')
}
