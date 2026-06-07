export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import SettingsClient from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const [hs, income, projSettings, mortgage, superSettings] = await Promise.all([
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.mortgageSettings.findFirst(),
    prisma.superSettings.findFirst(),
  ])

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
    />
  )
}
