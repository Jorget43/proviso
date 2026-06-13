import cron from 'node-cron'
import { prisma } from './db'

const RELEASES_URL = 'https://api.github.com/repos/Jorget43/household-dashboard/releases/latest'

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

export function isUpdateAvailable(current: string, latest: string): boolean {
  if (!current || current === 'dev' || !latest) return false
  const strip = (v: string) => v.replace(/^v/, '')
  return strip(latest) !== strip(current)
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
