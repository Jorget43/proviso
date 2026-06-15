import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const fy = req.nextUrl.searchParams.get('fy')
  const rows = await prisma.workExpense.findMany({
    where: fy ? { financialYr: Number(fy) } : undefined,
    orderBy: { date: 'desc' },
  })
  return Response.json(rows)
}

export async function POST(req: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { description, amount, date, category, financialYr, source, txnId, receiptRef, notes } = await req.json()
  if (!description || amount == null || !date || !financialYr) {
    return Response.json({ error: 'description, amount, date and financialYr are required' }, { status: 400 })
  }
  const row = await prisma.workExpense.create({
    data: {
      description: String(description),
      amount: Number(amount),
      date: String(date),
      category: category ?? 'Other',
      financialYr: Number(financialYr),
      source: source ?? 'manual',
      txnId: txnId ? Number(txnId) : null,
      receiptRef: receiptRef ? String(receiptRef) : '',
      notes: notes ? String(notes) : '',
    },
  })
  return Response.json(row, { status: 201 })
}
