export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { toMonthly } from '@/lib/formatting'
import type { LifePhase } from '@/lib/lifephases'
import ProjectionsClient from '@/components/projections/ProjectionsClient'

export default async function ProjectionsPage() {
  const me = await requireSession()
  const [income, settings, jorgePhases, gracePhases, oneoffs, lifePhases, expenses, debts, assets, mortgage, hs, feeSchedule] = await Promise.all([
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.jorgePhase.findMany({ orderBy: { year: 'asc' } }),
    prisma.gracePhase.findMany({ orderBy: { year: 'asc' } }),
    prisma.oneOff.findMany({ orderBy: { year: 'asc' } }),
    prisma.lifePhase.findMany({ orderBy: { sortOrder: 'asc' } }) as unknown as Promise<LifePhase[]>,
    prisma.expense.findMany(),
    prisma.debt.findMany(),
    prisma.asset.findMany(),
    prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.schoolFeeLevel.findMany({ orderBy: { id: 'asc' } }),
  ])

  const baseMonthlyExpenses = expenses.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)

  const mortDebt   = debts.find(d => d.name.toLowerCase().includes('mortgage'))?.amt ?? mortgage.balance
  const equity     = assets.find(a => a.name.toLowerCase().includes('house') || a.name.toLowerCase().includes('equity'))?.amt ?? 0
  const propValue  = mortDebt + equity
  const cryptoValue= assets.find(a => a.name.toLowerCase().includes('crypto'))?.amt ?? 0
  // Cash that offsets the mortgage = accounts flagged isOffset on Debts & Assets.
  // Falls back to the legacy 'cash'-named asset when nothing is flagged yet.
  const offsetAssets = assets.filter(a => a.isOffset)
  const cashOnHand = offsetAssets.length > 0
    ? offsetAssets.reduce((s, a) => s + a.amt, 0)
    : assets.find(a => a.name.toLowerCase().includes('cash'))?.amt ?? 0

  const currentYear = new Date().getFullYear()

  return (
    <ProjectionsClient
      canEdit={me.role === 'CFO'}
      initialSettings={settings}
      initialJorgePhases={jorgePhases}
      initialGracePhases={gracePhases}
      initialFeeSchedule={feeSchedule}
      initialOneoffs={oneoffs}
      initialLifePhases={lifePhases}
      income={income}
      baseMonthlyExpenses={baseMonthlyExpenses}
      mortBalance={mortDebt}
      mortRate={mortgage.rate}
      mortPayment={mortgage.payment}
      mortEndDate={mortgage.endDate}
      cashOnHand={cashOnHand}
      propValue={propValue}
      cryptoValue={cryptoValue}
      currentYear={currentYear}
      person1Name={hs?.person1Name ?? 'Person 1'}
      person2Name={hs?.person2Name ?? 'Person 2'}
    />
  )
}
