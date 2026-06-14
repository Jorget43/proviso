import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await prisma.annualExpense.findMany({ orderBy: { month: 'asc' } })
  return Response.json(rows)
}

export async function POST(req: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { name, cat, amt, month } = await req.json()
  if (!name || !cat || amt == null || month == null) {
    return Response.json({ error: 'name, cat, amt and month are required' }, { status: 400 })
  }
  const row = await prisma.annualExpense.create({ data: { name, cat, amt: Number(amt), month: Number(month) } })
  return Response.json(row, { status: 201 })
}
