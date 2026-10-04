export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Watchdog — developer instance only (WATCHDOG_ENABLED=true required)
  if (process.env.WATCHDOG_ENABLED === 'true') {
    const { startWatchdogScheduler } = await import('./lib/watchdogScheduler')
    startWatchdogScheduler()
  }

  // Net worth snapshots — ships to all deployments
  const { startNetWorthSnapshotScheduler } = await import('./lib/netWorthSnapshotScheduler')
  startNetWorthSnapshotScheduler()

  // Update-available banner — polls GitHub Releases daily 09:00 AEST and caches
  // the latest tag in the VersionCheck table. Ships to all deployments; the
  // banner is CFO-only and only fires for tagged (non-'dev') builds.
  const { startVersionCheckScheduler } = await import('./lib/versionCheck')
  startVersionCheckScheduler()
}
