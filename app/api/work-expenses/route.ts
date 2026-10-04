import { NextRequest } from 'next/server'
import { workExpenseSchema } from '@/lib/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { authorize, requireAdultRead } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const fy = req.nextUrl.searchParams.get('fy')
  const rows = await prisma.workExpense.findMany({
    where: fy ? { financialYr: Number(fy) } : undefined,
    orderBy: { date: 'desc' },
  })
  return Response.json(rows)
}

export const POST = withErrors(async (req: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { description, amount, date, category, financialYr, source, txnId, receiptRef, notes } = await parseBody(req, workExpenseSchema)
  const row = await prisma.workExpense.create({
    data: {
      description, amount, date, category: category ?? 'Other', financialYr,
      source: source ?? 'manual', txnId: txnId ?? null, receiptRef: receiptRef ?? '', notes: notes ?? '',
    },
  })
  return Response.json(row, { status: 201 })
})
