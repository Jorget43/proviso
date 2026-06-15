import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const WORK_EXPENSE_KEYWORDS = [
  'officeworks', 'office national', 'staples', 'paper plus',
  'linkedin', 'udemy', 'coursera', 'skillshare', 'pluralsight',
  'professional development', 'training course', 'conference',
  'work tools', 'work equipment', 'work supplies',
  'adobe', 'microsoft 365', 'microsoft office', 'notion', 'slack',
  'zoom', 'webex', 'teams subscription',
  'parking meter', 'car park', 'wilson parking', 'secure parking',
  'toll', 'linkt', 'e-way', 'fastway',
  'professional subscription', 'industry membership', 'union fee',
  'work uniform', 'protective equipment', 'ppe ',
]

export async function GET(req: NextRequest) {
  await requireSession()

  const fyParam = req.nextUrl.searchParams.get('fy')
  const fy = fyParam ? Number(fyParam) : new Date().getFullYear()

  const ymStart = `${fy - 1}-07`
  const ymEnd   = `${fy}-06`

  // Transactions already linked to a WorkExpense in this FY
  const linked = await prisma.workExpense.findMany({
    where: { financialYr: fy, txnId: { not: null } },
    select: { txnId: true },
  })
  const linkedIds = new Set(linked.map(w => w.txnId!))

  const all = await prisma.transaction.findMany({
    where: {
      ym: { gte: ymStart, lte: ymEnd },
      amt: { lt: 0 },
    },
    orderBy: { dateStr: 'desc' },
  })

  const lower = (s: string) => s.toLowerCase()
  const matches = all.filter(t => {
    if (linkedIds.has(t.id)) return false
    const desc = lower(t.desc)
    return WORK_EXPENSE_KEYWORDS.some(kw => desc.includes(kw))
  })

  return Response.json(matches)
}
