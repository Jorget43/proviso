import cron from 'node-cron'
import { computeWatchdog, type WatchStatus } from './watchdog'
import { sendWatchdogEmail } from './watchdogEmail'
import { prisma } from './db'

let started = false

export function startWatchdogScheduler() {
  if (started) return
  started = true

  // Monday 08:00 AEST (Australia/Sydney handles AEDT automatically)
  cron.schedule('0 8 * * 1', () => { runWatchdogCheck().catch(console.error) }, {
    timezone: 'Australia/Sydney',
  })

  console.log('[watchdog] scheduler running — fires Monday 08:00 AEST')
}

export async function runWatchdogCheck() {
  const report = computeWatchdog()

  const last = await prisma.watchdogSnapshot.findFirst({ orderBy: { takenAt: 'desc' } })

  let shouldEmail: boolean
  if (!last) {
    // First run — email if anything needs attention
    shouldEmail = report.items.some(i => i.status !== 'current')
  } else {
    const lastItems: Array<{ id: string; status: WatchStatus }> = JSON.parse(last.reportJson).items
    const lastMap = new Map(lastItems.map(i => [i.id, i.status]))
    shouldEmail = report.items.some(i => statusWorsened(lastMap.get(i.id), i.status))
  }

  const snapshot = await prisma.watchdogSnapshot.create({
    data: { reportJson: JSON.stringify(report) },
  })

  if (shouldEmail) {
    await sendWatchdogEmail(report)
    await prisma.watchdogSnapshot.update({
      where: { id: snapshot.id },
      data: { emailSentAt: new Date() },
    })
  }

  return { report, emailSent: shouldEmail }
}

function statusWorsened(prev: WatchStatus | undefined, curr: WatchStatus): boolean {
  const rank: Record<WatchStatus, number> = { current: 0, review: 1, overdue: 2 }
  return rank[curr] > (prev ? rank[prev] : 0)
}
