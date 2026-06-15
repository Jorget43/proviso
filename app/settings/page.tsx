export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { computeWatchdog } from '@/lib/watchdog'
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
  const [users, currentUser, userPasskeys] = await Promise.all([
    me.role === 'CFO'
      ? prisma.user.findMany({ select: { id: true, name: true, username: true, role: true, email: true, totpSecret: true }, orderBy: { id: 'asc' } })
      : Promise.resolve([]),
    prisma.user.findUnique({ where: { id: me.userId }, select: { totpSecret: true } }),
    prisma.passkey.findMany({
      where:   { userId: me.userId },
      select:  { id: true, name: true, deviceType: true, backedUp: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Developer watchdog prompt — only shown when WATCHDOG_ENABLED=true.
  // Never shown to end-user deployments regardless of role.
  const watchdogEnabled = process.env.WATCHDOG_ENABLED === 'true'
  const watchdog = me.role === 'CFO' && watchdogEnabled
    ? { attention: (() => { const c = computeWatchdog().counts; return c.overdue + c.review })() }
    : null

  const buildVersion = process.env.PROVISO_VERSION ?? 'dev'
  const buildDate    = process.env.BUILD_DATE ?? null

  return (
    <SettingsClient
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
      partnerEnabled={hs?.partnerEnabled ?? false}
      person1FTE={income.person1FTE}
      person2FTE={income.person2FTE}
      mortgageBalance={mortgage?.balance ?? 0}
      superBalance={superSettings?.currentBalance ?? 0}
      partnerSuperBalance={superSettings?.partnerBalance ?? 0}
      parentalLeaveEnabled={projSettings.parentalLeaveEnabled}
      currentRole={me.role}
      currentUserId={me.userId}
      users={users}
      hasTOTP={!!currentUser?.totpSecret}
      passkeys={userPasskeys.map(p => ({ ...p, createdAt: p.createdAt.toISOString() }))}
      watchdog={watchdog}
      buildVersion={buildVersion}
      buildDate={buildDate}
    />
  )
}
