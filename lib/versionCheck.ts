import cron from 'node-cron'
import { prisma } from './db'

const RELEASES_URL = 'https://api.github.com/repos/Jorget43/proviso/releases/latest'

export async function checkAndStoreLatestVersion(): Promise<void> {
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { 'User-Agent': 'proviso-version-check/1.0' },
    })
    if (!res.ok) return
    const data = await res.json() as { tag_name?: string }
    const tag = data.tag_name?.trim()
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

// True only when `latest` is a strictly newer release than `current`. A
// master build ahead of the last tag (`v1.6.0-2-g…`) shares that tag's core
// and is *newer* than it, so it must not be told to "update" to v1.6.0.
export function isUpdateAvailable(current: string, latest: string): boolean {
  if (!current || current === 'dev' || !latest) return false
  const cur = parseVersion(current)
  const lat = parseVersion(latest)
  if (!cur || !lat) return false
  for (let i = 0; i < 3; i++) {
    if (lat[i] !== cur[i]) return lat[i] > cur[i]
  }
  return false
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
