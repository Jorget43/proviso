import { NextRequest } from 'next/server'
import { annualExpenseSchema } from '@proviso/core/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { prisma } from '@/lib/db'
import { authorize, requireAdultRead } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const rows = await prisma.annualExpense.findMany({ orderBy: { month: 'asc' } })
  return Response.json(rows)
}

export const POST = withErrors(async (req: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const data = await parseBody(req, annualExpenseSchema)
  const row = await prisma.annualExpense.create({ data })
  return Response.json(row, { status: 201 })
})
