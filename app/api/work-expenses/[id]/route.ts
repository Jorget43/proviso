import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  const { description, amount, date, category, financialYr, receiptRef, notes } = await req.json()
  const row = await prisma.workExpense.update({
    where: { id: Number(id) },
    data: {
      description: String(description),
      amount: Number(amount),
      date: String(date),
      category: category ?? 'Other',
      financialYr: Number(financialYr),
      receiptRef: receiptRef ? String(receiptRef) : '',
      notes: notes ? String(notes) : '',
    },
  })
  return Response.json(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  await prisma.workExpense.delete({ where: { id: Number(id) } })
  return Response.json({ ok: true })
}
