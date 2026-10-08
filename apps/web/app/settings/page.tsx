export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireAdult } from '@/lib/auth'
import { computeWatchdog } from '@/lib/watchdog'
import SettingsClient from '@/components/settings/SettingsClient'
import { loadSituation } from '@/lib/situation'
import { listDevices } from '@/lib/devices'

export default async function SettingsPage() {
  const me = await requireAdult()
  const [hs, income, mortgage, superSettings, situation] = await Promise.all([
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.mortgageSettings.findFirst(),
    prisma.superSettings.findFirst(),
    loadSituation(),
  ])

  // Member list is CFO-only (matches the users:write guard on the API).
  const [userRows, currentUser, userPasskeys, devices] = await Promise.all([
    me.role === 'CFO'
      ? prisma.user.findMany({ select: { id: true, name: true, username: true, role: true, email: true, totpSecret: true }, orderBy: { id: 'asc' } })
      : Promise.resolve([]),
    prisma.user.findUnique({ where: { id: me.userId }, select: { totpSecret: true } }),
    prisma.passkey.findMany({
      where:   { userId: me.userId },
      select:  { id: true, name: true, deviceType: true, backedUp: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    listDevices(me.userId),
  ])
  // Only a 2FA-enrolled flag reaches the client — never the TOTP secret itself.
  const users = userRows.map(({ totpSecret, ...u }) => ({ ...u, hasTOTP: !!totpSecret }))

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
      theme={me.theme}
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
      partnerEnabled={hs?.partnerEnabled ?? false}
      person1FTE={income.person1FTE}
      person2FTE={income.person2FTE}
      mortgageBalance={mortgage?.balance ?? 0}
      superBalance={superSettings?.currentBalance ?? 0}
      partnerSuperBalance={superSettings?.partnerBalance ?? 0}
      situation={situation}
      currentRole={me.role}
      currentUserId={me.userId}
      users={users}
      hasTOTP={!!currentUser?.totpSecret}
      passkeys={userPasskeys.map(p => ({ ...p, createdAt: p.createdAt.toISOString() }))}
      devices={devices}
      watchdog={watchdog}
      buildVersion={buildVersion}
      buildDate={buildDate}
    />
  )
}
