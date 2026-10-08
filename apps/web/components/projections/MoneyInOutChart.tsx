'use client'
// Money in & out, year by year: each person's take-home pay as stacked bars,
// spending as a line on top, and in the readout the year's surplus or
// shortfall and the cash at the end of it. (Replaces the separate Income and
// "Good & tight years" charts: same figures, one picture.)
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { fmtK } from '@proviso/core/formatting'
import { crosshair, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart from '@/components/ui/ScrubChart'
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
}

const signed = (v: number) => (v > 0 ? '+' : '') + fmtK(v)

export default function MoneyInOutChart({
  labels, person1Data, person2Data, person1Name, person2Name, showPerson2, leaveYrs, spendData, sfTotalData, phaseData, cashData,
}: Props) {
  const c = useChartColors()
  const leave = new Set(leaveYrs)
  const income = person1Data.map((v, i) => v + (showPerson2 ? person2Data[i] ?? 0 : 0))
  const gap = income.map((v, i) => v - (spendData[i] ?? 0))
  // Readout-only series: listed with the year's values, not drawn.
  // On their own hidden scale, so they don't stretch the chart.
  const readOnly = { type: 'line' as const, borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, showLine: false, fill: false, yAxisID: 'readout' }

  const datasets = [
    { type: 'line' as const, label: 'Spending', data: spendData, borderColor: c.red, backgroundColor: c.red, borderWidth: 2.5, tension: 0.3, fill: false, order: 0,
      pointRadius: gap.map(g => (g < 0 ? 3.5 : 0)), pointBackgroundColor: c.red, pointHoverRadius: 4 },
    { type: 'bar' as const, label: person1Name, data: person1Data, backgroundColor: c.a(c.blue, 0.7), stack: 'in', borderRadius: 3, order: 2 },
    ...(showPerson2 ? [{ type: 'bar' as const, label: person2Name, data: person2Data, stack: 'in', borderRadius: 3, order: 2,
      backgroundColor: labels.map(y => (leave.has(Number(y)) ? c.a(c.pink, 0.7) : c.a(c.green, 0.7))) }] : []),
    { ...readOnly, label: 'Left over (or short)', data: gap, borderColor: c.t2, format: signed },
    { ...readOnly, label: 'Of the spending: school fees', data: sfTotalData, borderColor: c.amber },
    { ...readOnly, label: 'Of the spending: life stages', data: phaseData, borderColor: c.teal },
    { ...readOnly, label: 'Cash at the end of the year', data: cashData, borderColor: c.blue },
  ]

  return (
    <>
      <ScrubChart labels={labels} datasets={datasets} height={260}>
        <Chart type="bar" data={{ labels, datasets: datasets as never[] }} plugins={[crosshair]} options={{
          ...SCRUB_BASE,
          scales: {
            x: { stacked: true, ticks: axisTicks(c), grid: { display: false } },
            y: { stacked: false, beginAtZero: true, ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
            readout: { display: false },
          },
        }} />
      </ScrubChart>
      <p className="proj-note mt1">
        Bars: take-home pay{showPerson2 && leaveYrs.length ? ' (pink: parental leave)' : ''}. Line: everything that goes out, home loan repayments included; red dots mark years you&rsquo;d be short.
      </p>
    </>
  )
}
