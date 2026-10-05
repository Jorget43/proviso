import { NextRequest } from 'next/server'
import { withErrors, parseBody } from '@/lib/apiHandler'
import { transactionArraySchema } from '@proviso/core/schemas'
import { authorize } from '@/lib/rbac'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

// skipDuplicates is honoured at runtime but missing from Prisma 5's SQLite
// typings (see CLAUDE.md), so the call is given an explicit signature here.
type CreateManyWithSkip = (args: {
  data: Prisma.TransactionCreateManyInput[]
  skipDuplicates: boolean
}) => Promise<{ count: number }>

export const POST = withErrors(async (request: NextRequest) => {
  const gate = await authorize('actuals:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, transactionArraySchema)

  const result = await (prisma.transaction.createMany as unknown as CreateManyWithSkip)({
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
