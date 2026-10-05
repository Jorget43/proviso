import { withErrors, ApiError } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { deviceLabel } from '@/lib/devices'
import { audit } from '@/lib/audit'

// Sign out one of your own devices. Scoped to the caller's userId, so another
// user's session id simply isn't found.
export const DELETE = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const me = await getSession()
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id')

  const row = await prisma.session.findFirst({ where: { id, userId: me.userId }, select: { kind: true, userAgent: true } })
  if (!row) throw new ApiError(404, 'Not found')
  await prisma.session.deleteMany({ where: { id, userId: me.userId } })
  audit({ action: 'auth.sessions_revoked', userId: me.userId, username: me.username, detail: `signed out ${deviceLabel(row.userAgent, row.kind)}` })
  return Response.json({ ok: true })
})
