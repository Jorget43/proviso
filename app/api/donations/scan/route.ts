import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const DONATION_KEYWORDS = [
  'cancer council', 'red cross', 'vinnies', 'salvation army', 'oxfam', 'wwf',
  'beyond blue', 'smith family', 'lifeline', 'rspca', 'unicef', 'amnesty',
  'flying doctor', 'black dog', 'headspace', 'youth off streets', 'st vincent',
  'the smith', 'greenpeace', 'care australia', 'world vision', 'anglicare',
  'catholic care', 'uniting care', 'white ribbon', 'donate', 'appeal fund',
  'relief fund', 'charitable', 'foundation donate',
]

export async function GET(req: NextRequest) {
  await requireSession()

  const fyParam = req.nextUrl.searchParams.get('fy')
  const fy = fyParam ? Number(fyParam) : new Date().getFullYear()

  // FY runs July (prev year) through June (fy year)
  const ymStart = `${fy - 1}-07`
  const ymEnd   = `${fy}-06`

  // Transactions already linked to a Donation in this FY
  const linked = await prisma.donation.findMany({
    where: { financialYr: fy, txnId: { not: null } },
    select: { txnId: true },
  })
  const linkedIds = new Set(linked.map(d => d.txnId!))

  // Search transactions in the FY date range matching any donation keyword
  const all = await prisma.transaction.findMany({
    where: {
      ym: { gte: ymStart, lte: ymEnd },
      amt: { lt: 0 }, // expenses are negative
    },
    orderBy: { dateStr: 'desc' },
  })

  const lower = (s: string) => s.toLowerCase()
  const matches = all.filter(t => {
    if (linkedIds.has(t.id)) return false
    const desc = lower(t.desc)
    return DONATION_KEYWORDS.some(kw => desc.includes(kw))
  })

  return Response.json(matches)
}
