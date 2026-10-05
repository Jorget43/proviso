import { withErrors } from '@/lib/apiHandler'
import { getSession, revokeSessions } from '@/lib/auth'
import { listDevices } from '@/lib/devices'
import { audit } from '@/lib/audit'

// Your own signed-in devices (Settings → Your devices). Any signed-in user can
// see and end their own sessions; nobody else's.

export const GET = withErrors(async () => {
  const me = await getSession()
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json({ devices: await listDevices(me.userId) })
})

// Sign out every other device.
export const DELETE = withErrors(async () => {
  const me = await getSession()
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const count = await revokeSessions(me.userId, { keepCurrent: true })
  if (count > 0) audit({ action: 'auth.sessions_revoked', userId: me.userId, username: me.username, detail: `signed out ${count} other device${count === 1 ? '' : 's'}` })
  return Response.json({ ok: true, count })
})
