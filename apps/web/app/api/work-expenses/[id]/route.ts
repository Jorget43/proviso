import { NextRequest } from 'next/server'
import { workExpenseSchema } from '@proviso/core/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export const PUT = withErrors(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  // source/txnId are fixed at creation, so they're dropped from updates.
  const { description, amount, date, category, financialYr, receiptRef, notes } = await parseBody(req, workExpenseSchema.partial())
  const row = await prisma.workExpense.update({
    where: { id: Number(id) },
    data:  { description, amount, date, category, financialYr, receiptRef, notes },
  })
  return Response.json(row)
})

export const DELETE = withErrors(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  await prisma.workExpense.delete({ where: { id: Number(id) } })
  return Response.json({ ok: true })
})
