import { z } from 'zod'
import { prisma } from '@/lib/db'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { getSession } from '@/lib/auth'
import { THEME_CHOICES } from '@/lib/theme'

// Who is signed in — the native app's first call after starting, to check its
// token is still good and to pick the screens for the user's role.
export const GET = withErrors(async () => {
  const me = await getSession()
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json({ user: me })
})

// The signed-in user's own preferences (any role, children included).
const prefsSchema = z.object({ theme: z.enum(THEME_CHOICES as [string, ...string[]]) })

export const PATCH = withErrors(async (req: Request) => {
  const me = await getSession()
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { theme } = await parseBody(req, prefsSchema)
  await prisma.user.update({ where: { id: me.userId }, data: { themePreference: theme } })
  return Response.json({ ok: true, theme })
})
