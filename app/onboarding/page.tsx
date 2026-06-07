import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import OnboardingClient from '@/components/onboarding/OnboardingClient'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const hs = await prisma.householdSettings.findUnique({ where: { id: 1 } })
  if (hs?.onboardingDone) redirect('/budget')
  return <OnboardingClient />
}
