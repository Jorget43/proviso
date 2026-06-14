import { requireSession } from '@/lib/auth'
import { computeWatchdog } from '@/lib/watchdog'
import { sendWatchdogEmail } from '@/lib/watchdogEmail'

export async function POST() {
  const me = await requireSession()
  if (me.role !== 'CFO') return Response.json({ error: 'Forbidden' }, { status: 403 })

  if (process.env.WATCHDOG_ENABLED !== 'true') return Response.json({ error: 'Watchdog not enabled' }, { status: 403 })

  try {
    const report = computeWatchdog()
    await sendWatchdogEmail(report)
    return Response.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
