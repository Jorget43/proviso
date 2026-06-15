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
import DonationsPanel from '@/components/eofy/DonationsPanel'
import WorkExpensesPanel from '@/components/eofy/WorkExpensesPanel'

interface EofyMember {
  name:               string
  help:               HelpAlert | null
  carryForward:       CarryForwardResult
  salarySacrifice:    SalarySacrificeInsight
}

export default async function EofyPage() {
  await requireSession()
  const fyEnding = currentFinancialYearEnding()
  const fyLabel  = `FY${fyEnding - 1}–${String(fyEnding).slice(2)}`

  const [income, hs, superSettings, helpDetails, superHistory, donations, workExpenses] = await Promise.all([
    prisma.incomeSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.householdSettings.findUnique({ where: { id: 1 } }),
    prisma.superSettings.findFirst(),
    prisma.helpDebtDetail.findMany({ where: { financialYearEnding: fyEnding } }),
    prisma.superHistory.findMany({ orderBy: { financialYearEnding: 'desc' } }),
    prisma.donation.findMany({ where: { financialYr: fyEnding }, orderBy: { date: 'desc' } }),
    prisma.workExpense.findMany({ where: { financialYr: fyEnding }, orderBy: { date: 'desc' } }),
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

  const donationsTotal    = donations.reduce((s, d) => s + d.amount, 0)
  const workExpensesTotal = workExpenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="page">
      {/* Print-only header */}
      <div style={{ display: 'none' }} className="print-only">
        <h2 style={{ fontFamily: 'var(--font-dm-serif)', marginBottom: 4 }}>Proviso — EOFY Accountant Report</h2>
        <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 20 }}>{fyLabel} · Generated {new Date().toLocaleDateString('en-AU')}</p>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '1.6rem', margin: '0 0 4px' }}>
              End of Financial Year
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--t2)', margin: 0 }}>
              {fyLabel} · {inSeason
                ? 'These levers close at 30 June — act before then to capture them.'
                : 'Out of season — these tools are most relevant in May–June.'}
            </p>
          </div>
          <button
            onClick={() => typeof window !== 'undefined' && window.print()}
            style={{ fontSize: '0.75rem', color: 'var(--t2)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            className="no-print"
          >
            ⎙ Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── Salary-sacrifice / HELP / super (existing, one section per member) ── */}
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

      {/* ── Donations tracker ── */}
      <div style={{ marginBottom: 20 }}>
        <Panel title="Charitable donations" dotColor="var(--green)">
          <DonationsPanel
            initialDonations={donations as any}
            fyEnding={fyEnding}
            fyLabel={fyLabel}
          />
        </Panel>
      </div>

      {/* ── Work expenses tracker ── */}
      <div style={{ marginBottom: 20 }}>
        <Panel title="Work expenses" dotColor="var(--blue)">
          <WorkExpensesPanel
            initialExpenses={workExpenses as any}
            fyEnding={fyEnding}
            fyLabel={fyLabel}
          />
        </Panel>
      </div>

      {/* ── Accountant Report ── */}
      <div style={{ marginBottom: 20 }}>
        <Panel title="Accountant report summary" dotColor="var(--amber)">
          <p style={{ ...cardText, marginBottom: 12 }}>
            Summary for {fyLabel} — share with your accountant at tax time. Use the ⎙ Print / Save PDF button above to generate a PDF.
          </p>

          {/* Donations summary */}
          <div style={reportSection}>
            <div style={reportSectionHead}>
              <span>Charitable donations</span>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(donationsTotal)}</span>
            </div>
            {donations.length === 0 ? (
              <p style={cardMuted}>None recorded.</p>
            ) : (
              <table style={reportTable}>
                <thead>
                  <tr>
                    <th style={thStyle}>Charity</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Date</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map(d => (
                    <tr key={d.id}>
                      <td style={tdStyle}>
                        {d.charity}
                        {d.abn ? <span style={{ color: 'var(--t3)', fontSize: '0.68rem', display: 'block' }}>ABN {d.abn}</span> : null}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--t2)' }}>{d.date}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmt(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Work expenses summary */}
          <div style={reportSection}>
            <div style={reportSectionHead}>
              <span>Work expenses</span>
              <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{fmt(workExpensesTotal)}</span>
            </div>
            {workExpenses.length === 0 ? (
              <p style={cardMuted}>None recorded.</p>
            ) : (
              <table style={reportTable}>
                <thead>
                  <tr>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Category</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Date</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {workExpenses.map(e => (
                    <tr key={e.id}>
                      <td style={tdStyle}>
                        {e.description}
                        {e.receiptRef ? <span style={{ color: 'var(--t3)', fontSize: '0.68rem', display: 'block' }}>Ref: {e.receiptRef}</span> : null}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--t2)' }}>{e.category}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--t2)' }}>{e.date}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--blue)', fontWeight: 600 }}>{fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Other items to confirm with accountant */}
          <div style={reportSection}>
            <div style={reportSectionHead}><span>Other items to review with your accountant</span></div>
            <ul style={{ fontSize: '0.76rem', color: 'var(--t1)', lineHeight: 1.7, margin: 0, paddingLeft: '1.2rem' }}>
              <li>Super concessional contributions — see Super tab for carry-forward details</li>
              <li>HELP voluntary repayments — see Debts tab</li>
              <li>Investment CGT events — see Investments tab for parcel-level cost base and discount eligibility</li>
              <li>Private health insurance rebate adjustments</li>
              <li>Work-from-home deductions (fixed rate or actual cost method)</li>
            </ul>
          </div>
        </Panel>
      </div>

      <p style={{ fontSize: '0.68rem', color: 'var(--t3)', lineHeight: 1.5, marginTop: 8 }}>
        Estimates only, based on the figures you&apos;ve entered. Salary-sacrifice savings assume the room sits
        within your current marginal band. Confirm contribution caps, deduction eligibility, and timing with
        the ATO or your adviser before acting.
      </p>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          nav, header, .top-nav { display: none !important; }
          body { background: white !important; }
          .panel { break-inside: avoid; }
        }
      `}</style>
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

const reportSection: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 6,
  marginBottom: 12, overflow: 'hidden',
}
const reportSectionHead: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 12px', background: 'var(--surface2)',
  fontSize: '0.78rem', fontWeight: 600, color: 'var(--t1)',
}
const reportTable: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }
const thStyle: React.CSSProperties = { padding: '5px 12px', color: 'var(--t3)', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', textAlign: 'left' }
const tdStyle: React.CSSProperties = { padding: '5px 12px', borderBottom: '1px solid var(--border)', color: 'var(--t1)' }
