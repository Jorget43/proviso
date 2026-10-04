'use client'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { crosshair } from '@/lib/chartPlugins'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

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

  const datasets: object[] = [
    { label: sfOn ? 'Net worth (with school fees)' : 'Net worth', data: pad(nwData), borderColor: '#166B45', backgroundColor: 'rgba(22,107,69,0.07)', fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 3 },
    { label: 'Investments', data: pad(investData), borderColor: '#5235A8', backgroundColor: 'rgba(82,53,168,0.04)', fill: true, tension: 0.4, borderWidth: 1.5, pointRadius: 2, borderDash: [5, 4] },
    { label: 'Cash', data: pad(cashData), borderColor: '#1E5FA8', tension: 0.4, borderWidth: 1.5, pointRadius: 2, borderDash: [2, 4] },
    { label: 'Actual net worth', data: historyData.concat(Array(labels.length).fill(null)), borderColor: '#C48200', backgroundColor: '#C48200', fill: false, tension: 0, borderWidth: 2, pointRadius: 4, pointStyle: 'circle', spanGaps: true },
  ]
  if (sfOn && nwNoFees) {
    datasets.splice(1, 0, { label: 'Net worth (no school fees)', data: pad(nwNoFees), borderColor: 'rgba(22,107,69,0.4)', borderDash: [6, 3], borderWidth: 1.8, pointRadius: 2, fill: false, tension: 0.4 })
  }

  return (
    <div className="chart-wrap" style={{ height: 260 }}>
      <Line data={{ labels: allLabels, datasets: datasets as never[] }} plugins={[crosshair]} options={{
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: '#6A5F4A', boxWidth: 8, boxHeight: 8, usePointStyle: true } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: $${(ctx.parsed.y as number).toLocaleString('en-AU')}` } },
        },
        scales: {
          x: { ticks: { font: { size: 10 }, color: '#A09484' }, grid: { display: false } },
          y: { ticks: { callback: v => '$' + Math.round(Number(v) / 1000) + 'k', font: { size: 10 }, color: '#A09484' }, grid: { color: 'rgba(0,0,0,0.05)' } },
        },
      }} />
    </div>
  )
}
