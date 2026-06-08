export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { marginalRate } from '@/lib/tax'
import InvestmentsClient from '@/components/investments/InvestmentsClient'

export default async function InvestmentsPage() {
  await requireSession()
  const [parcels, income, hs] = await Promise.all([
    prisma.investmentParcel.findMany({ orderBy: { id: 'asc' } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
  ])

  const person1Name = hs?.person1Name ?? 'Person 1'
  const person2Name = hs?.person2Name ?? 'Person 2'

  // Each owner's marginal rate (incl. Medicare) drives the CGT estimate.
  const marginalByMember: Record<string, number> = {
    [person1Name]: marginalRate(income.jorgeFTE),
    [person2Name]: marginalRate(income.graceFTE),
  }

  const members = hs?.partnerEnabled ? [person1Name, person2Name] : [person1Name]

  return (
    <InvestmentsClient
      initialParcels={parcels}
      members={members}
      marginalByMember={marginalByMember}
    />
  )
}
