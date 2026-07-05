import cron from 'node-cron'
import { prisma } from './db'
import { computeCurrentNetWorth } from './netWorth'

export async function takeNetWorthSnapshot(): Promise<void> {
  const [debts, assets, mortgage] = await Promise.all([
    prisma.debt.findMany(),
    prisma.asset.findMany(),
    prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ])

  const { netWorth } = computeCurrentNetWorth(debts, assets, mortgage)
  const totalAssets = assets.reduce((s, a) => s + a.amt, 0)
  const totalDebts  = debts.reduce((s, d) => s + d.amt, 0)

  await prisma.netWorthSnapshot.create({
    data: { totalAssets, totalDebts, netWorth, source: 'auto' },
  })
}

let schedulerStarted = false

export function startNetWorthSnapshotScheduler(): void {
  // Run immediately on startup so a baseline point exists without waiting a month
  takeNetWorthSnapshot().catch(console.error)

  if (schedulerStarted) return
  schedulerStarted = true

  // 1st of each month, 06:00 AEST
  cron.schedule('0 6 1 * *', () => {
    takeNetWorthSnapshot().catch(console.error)
  }, { timezone: 'Australia/Sydney' })

  console.log('[net-worth-snapshot] scheduler running — fires 1st of month 06:00 AEST')
}
