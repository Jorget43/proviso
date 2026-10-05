import { NextRequest } from 'next/server'
import { donationSchema } from '@proviso/core/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export const PUT = withErrors(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  // source/txnId are fixed at creation, so they're dropped from updates.
  const { charity, abn, amount, date, financialYr, notes } = await parseBody(req, donationSchema.partial())
  const row = await prisma.donation.update({
    where: { id: Number(id) },
    data:  { charity, abn, amount, date, financialYr, notes },
  })
  return Response.json(row)
})

export const DELETE = withErrors(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  await prisma.donation.delete({ where: { id: Number(id) } })
  return Response.json({ ok: true })
})
