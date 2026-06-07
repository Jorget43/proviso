import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Reset onboarding so the wizard can be re-run
export async function POST() {
  await prisma.householdSettings.update({
    where: { id: 1 },
    data:  { onboardingDone: false },
  })
  return NextResponse.json({ ok: true })
}
