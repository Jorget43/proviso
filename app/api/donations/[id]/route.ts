import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  const { charity, abn, amount, date, financialYr, notes } = await req.json()
  const row = await prisma.donation.update({
    where: { id: Number(id) },
    data: {
      charity: String(charity),
      abn: abn ? String(abn) : '',
      amount: Number(amount),
      date: String(date),
      financialYr: Number(financialYr),
      notes: notes ? String(notes) : '',
    },
  })
  return Response.json(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res

  const { id } = await params
  await prisma.donation.delete({ where: { id: Number(id) } })
  return Response.json({ ok: true })
}
