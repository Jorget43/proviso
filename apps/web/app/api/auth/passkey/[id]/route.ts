import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { withErrors } from '@/lib/apiHandler'
import { audit } from '@/lib/audit'

export const DELETE = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const pk = await prisma.passkey.findUnique({ where: { id: Number(id) } })

  if (!pk) return Response.json({ error: 'Not found' }, { status: 404 })
  if (pk.userId !== user.userId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.passkey.delete({ where: { id: Number(id) } })
  audit({ action: 'auth.passkey_removed', userId: user.userId, username: user.username, target: pk.name })
  return Response.json({ ok: true })
})
