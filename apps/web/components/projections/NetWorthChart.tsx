'use client'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { crosshair, SCRUB_BASE, AXIS_TICKS, kTicks } from '@/lib/chartPlugins'
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
  // Pad the projected series with leading nulls so they still start exactly
  // where they always did; the "Actual" series only has points in the
  // history portion, sharing the same anchor year so it's visually
  // continuous with where the projected line begins.
  const pad = <T,>(arr: T[]) => Array(historyLabels.length).fill(null).concat(arr)
  const allLabels = [...historyLabels, ...labels]

  const datasets: (ScrubSeries & Record<string, unknown>)[] = [
    { label: sfOn ? 'Net worth (with school fees)' : 'Net worth', data: pad(nwData), borderColor: '#166B45', backgroundColor: 'rgba(22,107,69,0.07)', fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4 },
    { label: 'Investments', data: pad(investData), borderColor: '#5235A8', backgroundColor: 'rgba(82,53,168,0.04)', fill: true, tension: 0.4, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, borderDash: [5, 4] },
    { label: 'Cash', data: pad(cashData), borderColor: '#1E5FA8', tension: 0.4, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, borderDash: [2, 4] },
    { label: 'Actual net worth', data: historyData.concat(Array(labels.length).fill(null)), borderColor: '#C48200', backgroundColor: '#C48200', fill: false, tension: 0, borderWidth: 2, pointRadius: 4, pointStyle: 'circle', spanGaps: true },
  ]
  if (sfOn && nwNoFees) {
    datasets.splice(1, 0, { label: 'Net worth (no school fees)', data: pad(nwNoFees), borderColor: 'rgba(22,107,69,0.4)', borderDash: [6, 3], borderWidth: 1.8, pointRadius: 0, fill: false, tension: 0.4 })
  }

  return (
    <ScrubChart labels={allLabels} datasets={datasets} height={240}>
      <Line data={{ labels: allLabels, datasets: datasets as never[] }} plugins={[crosshair]} options={{
        ...SCRUB_BASE,
        scales: {
          x: { ticks: AXIS_TICKS, grid: { display: false } },
          y: { ticks: { ...AXIS_TICKS, callback: kTicks }, grid: { color: 'rgba(0,0,0,0.05)' } },
        },
      }} />
    </ScrubChart>
  )
}
