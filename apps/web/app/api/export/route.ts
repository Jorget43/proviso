import { withErrors } from '@/lib/apiHandler'
import { getSession } from '@/lib/auth'
import { exportHousehold } from '@/lib/householdExport'
import { audit } from '@/lib/audit'

// "Download all your data": the whole household in the local-first export
// format (packages/core/src/householdExport.ts). CFO only — it holds every
// figure, including other members' pocket money.
export const GET = withErrors(async () => {
  const me = await getSession()
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (me.role !== 'CFO') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const doc = await exportHousehold(process.env.PROVISO_VERSION ?? 'dev', now)
  audit({ action: 'data.export', userId: me.userId, username: me.username, detail: 'full household export' })

  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      'Content-Type':        'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="proviso-household-${now.toISOString().slice(0, 10)}.json"`,
      'Cache-Control':       'no-store',
    },
  })
})
