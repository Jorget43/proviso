export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Watchdog — developer instance only (WATCHDOG_ENABLED=true required)
  if (process.env.WATCHDOG_ENABLED === 'true') {
    const { startWatchdogScheduler } = await import('./lib/watchdogScheduler')
    startWatchdogScheduler()
  }
}
