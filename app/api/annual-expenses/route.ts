import { NextRequest } from 'next/server'
import { withErrors } from '@/lib/apiHandler'
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

  const { name, cat, amt, month } = await req.json()
  if (!name || !cat || amt == null || month == null) {
    return Response.json({ error: 'name, cat, amt and month are required' }, { status: 400 })
  }
  const row = await prisma.annualExpense.create({ data: { name, cat, amt: Number(amt), month: Number(month) } })
  return Response.json(row, { status: 201 })
})
