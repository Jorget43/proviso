import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export async function GET() {
  const expenses = await prisma.expense.findMany({ orderBy: { id: 'asc' } })
  return Response.json(expenses)
}

export async function POST(request: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await request.json()
  const expense = await prisma.expense.create({
    data: {
      cat:  body.cat  ?? 'Fun',
      name: body.name ?? 'New item',
      freq: body.freq ?? 'monthly',
      amt:  body.amt  ?? 0,
    },
  })
  return Response.json(expense, { status: 201 })
}
