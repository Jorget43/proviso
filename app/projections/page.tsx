import { prisma } from '@/lib/db'
import { toMonthly } from '@/lib/formatting'
import type { LifePhase } from '@/lib/lifephases'
import ProjectionsClient from '@/components/projections/ProjectionsClient'

export default async function ProjectionsPage() {
  const [income, settings, gracePhases, oneoffs, lifePhases, expenses, debts, assets, mortgage] = await Promise.all([
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.projectionSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.gracePhase.findMany({ orderBy: { year: 'asc' } }),
    prisma.oneOff.findMany({ orderBy: { year: 'asc' } }),
    prisma.lifePhase.findMany({ orderBy: { sortOrder: 'asc' } }) as unknown as Promise<LifePhase[]>,
    prisma.expense.findMany(),
    prisma.debt.findMany(),
    prisma.asset.findMany(),
    prisma.mortgageSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ])

  const baseMonthlyExpenses = expenses.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)

  const mortDebt   = debts.find(d => d.name.toLowerCase().includes('mortgage'))?.amt ?? mortgage.balance
  const equity     = assets.find(a => a.name.toLowerCase().includes('house') || a.name.toLowerCase().includes('equity'))?.amt ?? 0
  const propValue  = mortDebt + equity
  const cryptoValue= assets.find(a => a.name.toLowerCase().includes('crypto'))?.amt ?? 0
  const cashOnHand = assets.find(a => a.name.toLowerCase().includes('cash'))?.amt ?? 0

  const currentYear = new Date().getFullYear()

  return (
    <ProjectionsClient
      initialSettings={settings}
      initialGracePhases={gracePhases}
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
    />
  )
}
