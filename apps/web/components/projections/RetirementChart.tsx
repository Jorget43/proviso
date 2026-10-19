'use client'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { possessive } from '@proviso/core/formatting'
import { crosshair, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart, { type ScrubSeries } from '@/components/ui/ScrubChart'
import { overlayDatasets, type Overlay } from '@/lib/scenarioOverlay'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler)

// Retirement from the life-course projection (@proviso/core/projections):
// super by person, savings outside super, and what super pays each year.

interface RetirementChartProps {
  labels:       string[]
  super1:       number[]
  super2:       number[] | null
  outside:      number[]   // cash + investments outside super
  drawn:        number[]   // taken out of super each year
  person1Name:  string
  person2Name:  string
  /** Years marked on the axis: each person's retirement. */
  marks:        number[]
  /** Scenarios' total super, shown over the plan's. */
  overlays?:    Overlay[]
  /** Total super in the worst and best 1 in 10 runs (uncertainty.ts), shaded between. */
  band?:        { low: number[]; high: number[] } | null
}

export default function RetirementChart({ labels, super1, super2, outside, drawn, person1Name, person2Name, marks, overlays, band = null }: RetirementChartProps) {
  const c = useChartColors()
  const datasets: (ScrubSeries & Record<string, unknown>)[] = [
    { label: super2 ? `${possessive(person1Name)} super` : 'Super', data: super1, borderColor: c.teal, backgroundColor: c.a(c.teal, 0.08), fill: true, tension: 0.3, borderWidth: 2.2, pointRadius: 0 },
    ...(super2 ? [{ label: `${possessive(person2Name)} super`, data: super2, borderColor: c.purple, backgroundColor: c.a(c.purple, 0.06), fill: true, tension: 0.3, borderWidth: 2.2, pointRadius: 0 }] : []),
    { label: 'Savings outside super', data: outside, borderColor: c.blue, borderDash: [5, 4], tension: 0.3, borderWidth: 1.6, pointRadius: 0, fill: false },
    { label: 'Taken from super that year', data: drawn, borderColor: c.amber, borderDash: [2, 3], tension: 0.2, borderWidth: 1.4, pointRadius: 0, fill: false },
  ]
  datasets.splice(super2 ? 2 : 1, 0, ...overlayDatasets(overlays, c, labels.length, super1.map((v, i) => v + (super2?.[i] ?? 0))))
  if (band) {
    datasets.push(
      { label: 'Super, worst 1 in 10', data: band.low, borderColor: c.a(c.teal, 0.4), borderWidth: 1, pointRadius: 0, fill: false, tension: 0.3 },
      { label: 'Super, best 1 in 10', data: band.high, borderColor: c.a(c.teal, 0.4), backgroundColor: c.a(c.teal, 0.1), borderWidth: 1, pointRadius: 0, fill: '-1', tension: 0.3 },
    )
  }
  const first = labels.findIndex(l => marks.includes(Number(l)))

  return (
    <ScrubChart labels={labels} datasets={datasets} height={260} defaultIndex={first >= 0 ? first : undefined}>
      <Line data={{ labels, datasets: datasets as never[] }} plugins={[crosshair]} options={{
        ...SCRUB_BASE,
        scales: {
          x: {
            ticks: {
              ...axisTicks(c), autoSkip: false,
              callback: (_: unknown, i: number) => {
                const y = Number(labels[i])
                if (marks.includes(y)) return `↓${y}`
                // Regular labels every 5 years, except right next to a retirement mark.
                return i % 5 === 0 && !marks.some(m => Math.abs(m - y) <= 2) ? labels[i] : ''
              },
            },
            grid: { display: false },
          },
          y: { ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
        },
      }} />
    </ScrubChart>
  )
}
