import { prisma } from '@/lib/db'
import { withErrors } from '@/lib/apiHandler'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const member = new URL(req.url).searchParams.get('member')
  const rows = await prisma.superHistory.findMany({
    where:   member ? { member } : undefined,
    orderBy: { financialYearEnding: 'desc' },
  })
  return NextResponse.json(rows)
}

export const PUT = withErrors(async (req: Request) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const { member, financialYearEnding, concessionalCap, concessionalUtilised, totalSuperBalance } = await req.json()

  const record = await prisma.superHistory.upsert({
    where:  { member_financialYearEnding: { member, financialYearEnding } },
    update: { concessionalCap, concessionalUtilised, totalSuperBalance },
    create: { member, financialYearEnding, concessionalCap, concessionalUtilised, totalSuperBalance },
  })

  return NextResponse.json(record)
})
