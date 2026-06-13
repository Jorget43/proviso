export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Version check runs on all deployments — powers the in-app update banner
  const { startVersionCheckScheduler } = await import('./lib/versionCheck')
  startVersionCheckScheduler()

  // Watchdog — developer instance only (WATCHDOG_ENABLED=true required)
  if (process.env.WATCHDOG_ENABLED === 'true') {
    const { startWatchdogScheduler } = await import('./lib/watchdogScheduler')
    startWatchdogScheduler()
  }
}
