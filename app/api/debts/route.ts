import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export async function GET() {
  const debts = await prisma.debt.findMany({ orderBy: { id: 'asc' } })
  return Response.json(debts)
}

export async function POST(request: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await request.json()
  const debt = await prisma.debt.create({
    data: { name: body.name ?? 'New debt', amt: body.amt ?? 0 },
  })
  return Response.json(debt, { status: 201 })
}
