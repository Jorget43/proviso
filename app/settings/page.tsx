export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import SettingsClient from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const me = await requireSession()
  const [hs, income, projSettings, mortgage, superSettings] = await Promise.all([
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.mortgageSettings.findFirst(),
    prisma.superSettings.findFirst(),
  ])

  // Member list is CFO-only (matches the users:write guard on the API).
  const users = me.role === 'CFO'
    ? await prisma.user.findMany({ select: { id: true, name: true, username: true, role: true }, orderBy: { id: 'asc' } })
    : []

  return (
    <SettingsClient
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
      partnerEnabled={hs?.partnerEnabled ?? false}
      jorgeFTE={income.jorgeFTE}
      graceFTE={income.graceFTE}
      mortgageBalance={mortgage?.balance ?? 0}
      superBalance={superSettings?.currentBalance ?? 0}
      partnerSuperBalance={superSettings?.partnerBalance ?? 0}
      parentalLeaveEnabled={projSettings.parentalLeaveEnabled}
      currentRole={me.role}
      currentUserId={me.userId}
      users={users}
    />
  )
}
