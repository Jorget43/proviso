import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import OnboardingClient from '@/components/onboarding/OnboardingClient'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const me = await requireAdult()
  // The wizard saves via budget:write, so only a CFO can complete it.
  if (me.role !== 'CFO') redirect('/budget')
  const hs = await prisma.householdSettings.findUnique({ where: { id: 1 } })
  if (hs?.onboardingDone) redirect('/budget')
  return <OnboardingClient />
}
