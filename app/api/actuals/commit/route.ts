import { NextRequest } from 'next/server'
import { withErrors, parseBody } from '@/lib/apiHandler'
import { transactionArraySchema } from '@/lib/schemas'
import { authorize } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export const POST = withErrors(async (request: NextRequest) => {
  const gate = await authorize('actuals:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, transactionArraySchema)

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
})
