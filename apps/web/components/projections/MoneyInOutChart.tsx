'use client'
// Money in & out, year by year: each person's take-home pay as stacked bars,
// spending as a line on top, and in the readout the year's surplus or
// shortfall and the cash at the end of it. (Replaces the separate Income and
// "Good & tight years" charts: same figures, one picture.)
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { fmtK } from '@proviso/core/formatting'
import { crosshair, endLabels, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart from '@/components/ui/ScrubChart'
import { overlayDatasets, type Overlay } from '@/lib/scenarioOverlay'
import { moneyIn } from '@proviso/core/yearByYear'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale)

interface Props {
  labels:       string[]
  person1Data:  number[]
  person2Data:  number[]
  person1Name:  string
  person2Name:  string
  showPerson2:  boolean
  leaveYrs:     number[]
  spendData:    number[]
  sfTotalData:  number[]
  phaseData:    number[]
  cashData:     number[]
  /** Taken out of super to live on, stacked on the pay bars (retirement). */
  superData?:   number[]
  /** Interest less tax on savings and investment income (can be negative: tax on reinvested dividends). */
  investData?:  number[]
  /** Business income after its tax and HELP, stacked on the pay bars. */
  businessData?: number[]
  /** One-offs bringing money in (inheritances, sales, borrowing): listed, not drawn (they'd dwarf the year's pay). */
  oneoffInData?: number[]
  /** Scenarios' spending, as lines over the plan's, with what's left over in the readout. */
  overlays?:    Overlay[]
}

export const signed = (v: number) => (v > 0 ? '+' : '') + fmtK(v)

export default function MoneyInOutChart({
  labels, person1Data, person2Data, person1Name, person2Name, showPerson2, leaveYrs, spendData, sfTotalData, phaseData, cashData, superData, investData, businessData, oneoffInData, overlays,
}: Props) {
  const c = useChartColors()
  const leave = new Set(leaveYrs)
  const fromSuper = superData?.some(v => v > 0) ? superData : null
  const income = moneyIn({ person1Arr: person1Data, person2Arr: person2Data, superDrawArr: fromSuper ?? undefined, investIncArr: investData, businessArr: businessData }, showPerson2)
  const fromBusiness = businessData?.some(v => v > 0) ? businessData : null
  const fromInvest = investData?.some(v => v !== 0) ? investData : null
  const gap = income.map((v, i) => v - (spendData[i] ?? 0))
  // Readout-only series: listed with the year's values, not drawn.
  // On their own hidden scale, so they don't stretch the chart.
  const readOnly = { type: 'line' as const, borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, showLine: false, fill: false, yAxisID: 'readout' }

  const datasets = [
    // Its own stack, so it isn't added on top of the pay bars.
    { type: 'line' as const, label: 'Spending', endLabel: 'Spending', data: spendData, stack: 'out', borderColor: c.red, backgroundColor: c.red, borderWidth: 2.5, tension: 0.3, fill: false, order: 0,
      pointRadius: gap.map(g => (g < 0 ? 3.5 : 0)), pointBackgroundColor: c.red, pointHoverRadius: 4 },
    { type: 'bar' as const, label: person1Name, data: person1Data, backgroundColor: c.a(c.blue, 0.7), stack: 'in', borderRadius: 3, order: 2 },
    ...(showPerson2 ? [{ type: 'bar' as const, label: person2Name, data: person2Data, stack: 'in', borderRadius: 3, order: 2,
      backgroundColor: labels.map(y => (leave.has(Number(y)) ? c.a(c.pink, 0.7) : c.a(c.green, 0.7))) }] : []),
    ...(fromBusiness ? [{ type: 'bar' as const, label: 'Bonuses and business income, after tax', data: fromBusiness, backgroundColor: c.a(c.purple, 0.7), stack: 'in', borderRadius: 3, order: 2 }] : []),
    ...(fromSuper ? [{ type: 'bar' as const, label: 'From super', data: fromSuper, backgroundColor: c.a(c.teal, 0.7), stack: 'in', borderRadius: 3, order: 2 }] : []),
    // Drawn only when it adds money; a year where tax on reinvested dividends
    // outweighs the interest shows $0 here and is still counted in "left over".
    ...(fromInvest ? [{ type: 'bar' as const, label: 'Interest and dividends, after tax', data: fromInvest.map(v => Math.max(0, v)), backgroundColor: c.a(c.t3, 0.55), stack: 'in', borderRadius: 3, order: 2 }] : []),
    { ...readOnly, label: 'Left over (or short)', data: gap, borderColor: c.t2, format: signed },
    ...(oneoffInData?.some(v => v > 0) ? [{ ...readOnly, label: 'One-off money in (not in the bars)', data: oneoffInData, borderColor: c.green }] : []),
    { ...readOnly, detail: true, label: 'Of the spending: school fees', data: sfTotalData, borderColor: c.amber },
    { ...readOnly, detail: true, label: 'Of the spending: life stages', data: phaseData, borderColor: c.teal },
    { ...readOnly, detail: true, label: 'Cash at the end of the year', data: cashData, borderColor: c.blue },
    ...overlayDatasets(overlays, c, labels.length, spendData, 0, 'line'),
  ]

  return (
    <>
      <ScrubChart labels={labels} datasets={datasets} height={260}>
        <Chart type="bar" data={{ labels, datasets: datasets as never[] }} plugins={[crosshair, endLabels]} options={{
          ...SCRUB_BASE,
          scales: {
            x: { stacked: true, ticks: axisTicks(c), grid: { display: false } },
            y: { stacked: true, beginAtZero: true, ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
            readout: { display: false },
          },
        }} />
      </ScrubChart>
      <p className="proj-note mt1">
        Bars: take-home pay{fromBusiness ? ', bonuses and business income after tax' : ''}{fromInvest ? ', interest and dividends after tax' : ''}{fromSuper ? ', then money taken from super in retirement' : ''}{showPerson2 && leaveYrs.length ? ' (pink: parental leave)' : ''}. Line: everything that goes out, home loan repayments included; red dots mark years you&rsquo;d be short.
      </p>
    </>
  )
}
