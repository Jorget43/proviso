export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import Panel from '@/components/ui/Panel'
import { fmt } from '@/lib/formatting'
import {
  computeHelpAlert, daysUntilIndexation, isPostIndexation, type HelpAlert,
} from '@/lib/help'
import {
  computeCarryForward, currentFinancialYearEnding, type CarryForwardResult,
} from '@/lib/superHistory'
import { isEofySeason, computeSalarySacrifice, type SalarySacrificeInsight } from '@/lib/eofy'

interface EofyMember {
  name:               string
  help:               HelpAlert | null
  carryForward:       CarryForwardResult
  salarySacrifice:    SalarySacrificeInsight
}

export default async function EofyPage() {
  await requireSession()
  const fyEnding = currentFinancialYearEnding()

  const [income, hs, superSettings, helpDetails, superHistory] = await Promise.all([
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.superSettings.findFirst(),
    prisma.helpDebtDetail.findMany({ where: { financialYearEnding: fyEnding } }),
    prisma.superHistory.findMany({ orderBy: { financialYearEnding: 'desc' } }),
  ])

  const person1Name = hs?.person1Name ?? 'Person 1'
  const person2Name = hs?.person2Name ?? 'Person 2'
  const sgRate      = superSettings?.sgRate ?? 0.12

  const roster = [
    { name: person1Name, income: income.person1FTE, extra: superSettings?.additionalContribs ?? 0 },
    ...(hs?.partnerEnabled
      ? [{ name: person2Name, income: income.person2FTE, extra: superSettings?.partnerAdditionalContribs ?? 0 }]
      : []),
  ]

  const members: EofyMember[] = roster.map(({ name, income: gross, extra }) => {
    const hd = helpDetails.find(d => d.member === name) ?? null
    const help = hd && hd.openingFyBalance > 0
      ? computeHelpAlert({
          member: name, financialYearEnding: fyEnding,
          openingFyBalance: hd.openingFyBalance, voluntaryRepayments: hd.voluntaryRepayments,
          cpiRate: hd.cpiRate, grossIncome: gross,
        })
      : null
    const carryForward = computeCarryForward(name, superHistory.filter(r => r.member === name))
    const salarySacrifice = computeSalarySacrifice(gross, sgRate, carryForward.maxConcessionalThisYear, extra)
    return { name, help, carryForward, salarySacrifice }
  })

  const helpDays    = daysUntilIndexation(fyEnding)
  const postIndex   = isPostIndexation(fyEnding)
  const inSeason    = isEofySeason()
  const fyLabel     = `FY${fyEnding - 1}–${String(fyEnding).slice(2)}`

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.6rem', margin: '0 0 4px' }}>
          End of Financial Year
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--t2)', margin: 0 }}>
          {fyLabel} · {inSeason
            ? 'These levers close at 30 June — act before then to capture them.'
            : 'Out of season — these tools are most relevant in May–June.'}
        </p>
      </div>

      {members.map(({ name, help, carryForward, salarySacrifice }) => (
        <div key={name} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 10 }}>{name}</div>
          <div className="two-col">
            {/* HELP indexation */}
            <Panel title="HELP indexation" dotColor="var(--amber)">
              {help && help.indexableBase > 0 ? (
                postIndex ? (
                  <p style={cardText}>
                    Indexation was applied on 1 June {fyEnding}. Your indexable balance was{' '}
                    {fmt(help.indexableBase)} (+{fmt(help.increase)} at {help.cpiRate.toFixed(1)}%).
                  </p>
                ) : (
                  <>
                    <p style={cardText}>
                      <strong>{helpDays} {helpDays === 1 ? 'day' : 'days'}</strong> until indexation.
                      Your {fmt(help.indexableBase)} indexable balance will grow by{' '}
                      <strong>{fmt(help.increase)}</strong> at {help.cpiRate.toFixed(1)}%.
                    </p>
                    <p style={cardHi('var(--green)')}>
                      Paying {fmt(help.suggestedPayment)} to the ATO before 1 June avoids it — a guaranteed{' '}
                      {help.cpiRate.toFixed(1)}% tax-free saving, worth {help.preTaxEquivReturn.toFixed(1)}% pre-tax.
                    </p>
                    <Link href="/debts" style={cardLink}>Open HELP tracker →</Link>
                  </>
                )
              ) : (
                <p style={cardMuted}>No HELP debt recorded. Add details on the Debts tab if applicable.</p>
              )}
            </Panel>

            {/* Super concessional top-up */}
            <Panel title="Super concessional top-up" dotColor="var(--purple)">
              {carryForward.availableCarryForward > 0 && carryForward.eligible ? (
                <>
                  <p style={cardText}>
                    <strong>{fmt(carryForward.availableCarryForward)}</strong> of unused cap can be carried
                    forward. With this year&apos;s {fmt(carryForward.currentCap)} cap you could contribute up to{' '}
                    <strong>{fmt(carryForward.maxConcessionalThisYear)}</strong> concessionally.
                  </p>
                  <Link href="/super" style={cardLink}>Open carry-forward →</Link>
                </>
              ) : carryForward.availableCarryForward > 0 && !carryForward.eligible ? (
                <p style={cardText}>
                  {fmt(carryForward.availableCarryForward)} of unused cap has accrued, but your prior 30 June
                  balance is at or above the $500k threshold, so it can&apos;t be used this year.
                </p>
              ) : (
                <p style={cardMuted}>
                  No carried-forward cap recorded. This year&apos;s cap is {fmt(carryForward.currentCap)}.
                  Add prior-year history on the Super tab.
                </p>
              )}
            </Panel>

            {/* Salary sacrifice / marginal rate */}
            <Panel title="Salary sacrifice" dotColor="var(--blue)">
              {salarySacrifice.concessionalRoom > 0 ? (
                <>
                  <p style={cardText}>
                    {fmt(salarySacrifice.concessionalRoom)} of concessional room left. Sacrificing it saves about{' '}
                    <strong>{fmt(salarySacrifice.taxSavingFull)}</strong> in tax
                    ({(salarySacrifice.marginalRate * 100).toFixed(0)}% marginal vs{' '}
                    {(salarySacrifice.contributionsTaxRate * 100).toFixed(0)}% in super).
                  </p>
                  {salarySacrifice.crossesBracket && salarySacrifice.sacrificeToThreshold !== null && (
                    <p style={cardHi('var(--blue)')}>
                      Sacrificing {fmt(salarySacrifice.sacrificeToThreshold)} drops taxable income to{' '}
                      {fmt(salarySacrifice.nextLowerThreshold!)} — below the next bracket threshold.
                    </p>
                  )}
                </>
              ) : (
                <p style={cardMuted}>
                  Employer SG already uses your concessional cap — no extra salary-sacrifice room this year.
                </p>
              )}
            </Panel>
          </div>
        </div>
      ))}

      <p style={{ fontSize: '0.68rem', color: 'var(--t3)', lineHeight: 1.5, marginTop: 8 }}>
        Estimates only, based on the figures you&apos;ve entered. Salary-sacrifice savings assume the room sits
        within your current marginal band. Confirm contribution caps and timing with the ATO or your adviser
        before acting.
      </p>
    </div>
  )
}

const cardText:  React.CSSProperties = { fontSize: '0.78rem', color: 'var(--t1)', lineHeight: 1.5, margin: '0 0 8px' }
const cardMuted: React.CSSProperties = { fontSize: '0.76rem', color: 'var(--t3)', lineHeight: 1.5, margin: 0 }
const cardLink:  React.CSSProperties = { fontSize: '0.74rem', fontWeight: 600, color: 'var(--blue)' }
const cardHi = (color: string): React.CSSProperties => ({
  fontSize: '0.75rem', lineHeight: 1.45, margin: '0 0 8px',
  padding: '7px 9px', borderRadius: 5, color,
  background: `color-mix(in srgb, ${color} 10%, transparent)`,
  border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
})
