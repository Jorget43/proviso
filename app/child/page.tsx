export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import PocketMoneyClient from '@/components/child/PocketMoneyClient'

export default async function ChildPage() {
  const session = await requireSession()

  // CFO/PARTNER have no pocket money — redirect to their home
  if (session.role !== 'CHILD') redirect('/budget')

  const [txs, schedule] = await Promise.all([
    prisma.pocketMoneyTx.findMany({
      where:   { userId: session.userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.allowanceSchedule.findUnique({ where: { userId: session.userId } }),
  ])

  const balance = txs.reduce((sum, t) => sum + t.amount, 0)

  return (
    <PocketMoneyClient
      name={session.name}
      balance={balance}
      schedule={schedule ? { amount: schedule.amount, dayOfWeek: schedule.dayOfWeek } : null}
      txs={txs.map(t => ({ id: t.id, amount: t.amount, description: t.description, date: t.date, category: t.category }))}
    />
  )
}
