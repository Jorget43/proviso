import { destroySession, getSession } from '@/lib/auth'
import { withErrors } from '@/lib/apiHandler'
import { audit } from '@/lib/audit'

export const POST = withErrors(async () => {
  const user = await getSession()
  await destroySession()
  if (user) audit({ action: 'auth.signout', userId: user.userId, username: user.username })
  return Response.json({ ok: true })
})
