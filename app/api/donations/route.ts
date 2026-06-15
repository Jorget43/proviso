import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const fy = req.nextUrl.searchParams.get('fy')
  const rows = await prisma.donation.findMany({
    where: fy ? { financialYr: Number(fy) } : undefined,
    orderBy: { date: 'desc' },
  })
  return Response.json(rows)
}

export async function POST(req: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { charity, abn, amount, date, financialYr, source, txnId, notes } = await req.json()
  if (!charity || amount == null || !date || !financialYr) {
    return Response.json({ error: 'charity, amount, date and financialYr are required' }, { status: 400 })
  }
  const row = await prisma.donation.create({
    data: {
      charity: String(charity),
      abn: abn ? String(abn) : '',
      amount: Number(amount),
      date: String(date),
      financialYr: Number(financialYr),
      source: source ?? 'manual',
      txnId: txnId ? Number(txnId) : null,
      notes: notes ? String(notes) : '',
    },
  })
  return Response.json(row, { status: 201 })
}
