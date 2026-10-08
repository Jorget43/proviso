'use client'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { crosshair, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart, { type ScrubSeries } from '@/components/ui/ScrubChart'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler)

interface NetWorthChartProps {
  labels:    string[]
  nwData:    number[]
  nwNoFees:  number[] | null
  investData:number[]
  cashData:  number[]
  sfOn:      boolean
  historyLabels?: string[]
  historyData?:   number[]
}

export default function NetWorthChart({ labels, nwData, nwNoFees, investData, cashData, sfOn, historyLabels = [], historyData = [] }: NetWorthChartProps) {
  const c = useChartColors()
  // Pad the projected series with leading nulls so they still start exactly
  // where they always did; the "Actual" series only has points in the
  // history portion, sharing the same anchor year so it's visually
  // continuous with where the projected line begins.
  const pad = <T,>(arr: T[]) => Array(historyLabels.length).fill(null).concat(arr)
  const allLabels = [...historyLabels, ...labels]

  const datasets: (ScrubSeries & Record<string, unknown>)[] = [
    { label: sfOn ? 'Net worth (with school fees)' : 'Net worth', data: pad(nwData), borderColor: c.green, backgroundColor: c.a(c.green, 0.07), fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4 },
    { label: 'Investments', data: pad(investData), borderColor: c.purple, backgroundColor: c.a(c.purple, 0.04), fill: true, tension: 0.4, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, borderDash: [5, 4] },
    { label: 'Cash', data: pad(cashData), borderColor: c.blue, tension: 0.4, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, borderDash: [2, 4] },
    { label: 'Actual net worth', data: historyData.concat(Array(labels.length).fill(null)), borderColor: c.amber, backgroundColor: c.amber, fill: false, tension: 0, borderWidth: 2, pointRadius: 4, pointStyle: 'circle', spanGaps: true },
  ]
  if (sfOn && nwNoFees) {
    datasets.splice(1, 0, { label: 'Net worth (no school fees)', data: pad(nwNoFees), borderColor: c.a(c.green, 0.4), borderDash: [6, 3], borderWidth: 1.8, pointRadius: 0, fill: false, tension: 0.4 })
  }

  return (
    <ScrubChart labels={allLabels} datasets={datasets} height={240}>
      <Line data={{ labels: allLabels, datasets: datasets as never[] }} plugins={[crosshair]} options={{
        ...SCRUB_BASE,
        scales: {
          x: { ticks: axisTicks(c), grid: { display: false } },
          y: { ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
        },
      }} />
    </ScrubChart>
  )
}
