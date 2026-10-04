import { prisma } from '@/lib/db'
import { withErrors } from '@/lib/apiHandler'
import { authorize } from '@/lib/rbac'
import { NextResponse } from 'next/server'

// Reset onboarding so the wizard can be re-run
export const POST = withErrors(async () => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  await prisma.householdSettings.update({
    where: { id: 1 },
    data:  { onboardingDone: false },
  })
  return NextResponse.json({ ok: true })
})
