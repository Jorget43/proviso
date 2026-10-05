import { withErrors } from '@/lib/apiHandler'
import { getSession } from '@/lib/auth'

// Who is signed in — the native app's first call after starting, to check its
// token is still good and to pick the screens for the user's role.
export const GET = withErrors(async () => {
  const me = await getSession()
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json({ user: me })
})
