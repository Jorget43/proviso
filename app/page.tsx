import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let hs = await prisma.householdSettings.findUnique({ where: { id: 1 } })
  if (!hs) {
    // Existing install predating the onboarding feature — create a skipped record
    hs = await prisma.householdSettings.upsert({
      where:  { id: 1 },
      update: {},
      create: { id: 1, person1Name: 'You', person2Name: 'Partner', partnerEnabled: true, onboardingDone: true },
    })
  }
  if (!hs.onboardingDone) redirect('/onboarding')
  redirect('/budget')
}
