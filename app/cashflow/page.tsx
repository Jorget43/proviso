export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { calcAfterTax } from '@/lib/tax'
import { toMonthly } from '@/lib/formatting'
import { CATS, LUMPY, PPL_MONTHLY, PPL_MONTHS } from '@/lib/constants'
import Panel from '@/components/ui/Panel'
import CashflowBanner from '@/components/cashflow/CashflowBanner'
import CashflowLineChart from '@/components/cashflow/CashflowLineChart'
import IncVsExpChart from '@/components/cashflow/IncVsExpChart'

export default async function CashflowPage() {
  const [income, expenses, gracePhases, assets] = await Promise.all([
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.expense.findMany(),
    prisma.gracePhase.findMany(),
    prisma.asset.findMany(),
  ])

  const currentYear = new Date().getFullYear()
  const currentPhase = gracePhases.find(p => p.year === currentYear)
  const currentDays = currentPhase?.days ?? 3

  const cashOnHand = assets.find(a => a.name.toLowerCase().includes('cash'))?.amt ?? 0

  // Monthly net income
  const jorgeNet = income.taxMode
    ? calcAfterTax(income.jorgeFTE, false) / 12
    : income.jorgeMonthlyNet

  const graceNet = income.taxMode
    ? calcAfterTax(income.graceFTE * (currentDays / 5), income.graceHasHELP) / 12
    : income.graceMonthlyNet

  const totalInc = jorgeNet + graceNet
  const totalExp = expenses.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0)
  const delta = totalInc - totalExp

  const leaveDelta = jorgeNet + PPL_MONTHLY - totalExp
  const burnDelta  = jorgeNet - totalExp
  const runway     = burnDelta < 0 ? cashOnHand / Math.abs(burnDelta) : Infinity

  // Lumpy hits by calendar month (1-12)
  const lumpyByMonth: Record<number, number> = {}
  LUMPY.forEach(l => { lumpyByMonth[l.month] = (lumpyByMonth[l.month] ?? 0) + l.amt })

  // 24-month arrays
  const now = new Date()
  const n = 24
  const labels = Array.from({ length: n }, (_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() + i + 1)
    return d.toLocaleString('default', { month: 'short', year: '2-digit' })
  })

  const cfData = Array.from({ length: n }, (_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() + i + 1)
    return Math.round(cashOnHand + delta * (i + 1) - (lumpyByMonth[d.getMonth() + 1] ?? 0))
  })

  const burnData = Array.from({ length: n }, (_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() + i + 1)
    const pm   = Math.min(i + 1, PPL_MONTHS)
    const post = Math.max(0, i + 1 - PPL_MONTHS)
    return Math.max(0, Math.round(
      cashOnHand + pm * leaveDelta + post * (jorgeNet - totalExp) - (lumpyByMonth[d.getMonth() + 1] ?? 0)
    ))
  })

  // Category monthly for inc vs exp chart
  const catMonthly: Record<string, number> = {}
  CATS.forEach(c => { catMonthly[c] = 0 })
  expenses.forEach(e => { catMonthly[e.cat] = (catMonthly[e.cat] ?? 0) + toMonthly(e.amt, e.freq) })

  return (
    <div className="page">
      <CashflowBanner
        delta={delta}
        leaveDelta={leaveDelta}
        burnDelta={burnDelta}
        cashOnHand={cashOnHand}
        runway={runway}
      />
      <div className="two-col">
        <Panel title="24-month cashflow (both working)" dotColor="var(--green)">
          <CashflowLineChart
            labels={labels}
            data={cfData}
            color="#166B45"
            note="Lumpy month hits applied in relevant months."
          />
        </Panel>
        <Panel title="Parental leave scenario" dotColor="var(--pink)">
          <CashflowLineChart
            labels={labels}
            data={burnData}
            color="#9B2560"
            note="Person2 on leave — PPL for 18 wks, then Person1 only."
          />
        </Panel>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <Panel title="Income vs expenses by category" dotColor="var(--blue)">
          <IncVsExpChart totalInc={totalInc} catMonthly={catMonthly} />
        </Panel>
      </div>
    </div>
  )
}
