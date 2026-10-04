import { NextRequest } from 'next/server'
import { donationSchema } from '@/lib/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { authorize, requireAdultRead } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const fy = req.nextUrl.searchParams.get('fy')
  const rows = await prisma.donation.findMany({
    where: fy ? { financialYr: Number(fy) } : undefined,
    orderBy: { date: 'desc' },
  })
  return Response.json(rows)
}

export const POST = withErrors(async (req: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { charity, abn, amount, date, financialYr, source, txnId, notes } = await parseBody(req, donationSchema)
  const row = await prisma.donation.create({
    data: { charity, abn: abn ?? '', amount, date, financialYr, source: source ?? 'manual', txnId: txnId ?? null, notes: notes ?? '' },
  })
  return Response.json(row, { status: 201 })
})
