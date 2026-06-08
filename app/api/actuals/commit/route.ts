import { NextRequest } from 'next/server'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const gate = await authorize('actuals:write')
  if (!gate.ok) return gate.res
  const body: { dateStr: string; ym: string; desc: string; amt: number; cat: string; originalCat: string; catSource: string; lumpy: boolean }[] = await request.json()

  const result = await (prisma.transaction.createMany as Function)({
    data: body.map((t: typeof body[0]) => ({
      dateStr:     t.dateStr,
      ym:          t.ym,
      desc:        t.desc,
      amt:         t.amt,
      cat:         t.cat,
      originalCat: t.originalCat,
      catSource:   t.catSource,
      lumpy:       t.lumpy,
    })),
    skipDuplicates: true,
  })

  const all = await prisma.transaction.findMany({ orderBy: { importedAt: 'asc' } })
  return Response.json({ committed: result.count, skipped: body.length - result.count, transactions: all })
}
