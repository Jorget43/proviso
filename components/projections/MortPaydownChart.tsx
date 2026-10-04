'use client'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { crosshair } from '@/lib/chartPlugins'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

interface MortPaydownChartProps {
  labels:   string[]
  mortData: number[]
  endDate:  string
}

export default function MortPaydownChart({ labels, mortData, endDate }: MortPaydownChartProps) {
  const clearedIdx = mortData.findIndex(v => v <= 0)
  const clearedYr  = clearedIdx >= 0 ? labels[clearedIdx] : null
  const end = new Date(endDate)
  const now = new Date()
  const yrs = Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25))

  return (
    <>
      <div className="chart-wrap" style={{ height: 170 }}>
        <Line data={{
          labels,
          datasets: [{ label: 'Mortgage balance', data: mortData, borderColor: '#9B2525', backgroundColor: 'rgba(155,37,37,0.07)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 2 }],
        }} plugins={[crosshair]} options={{
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index' as const, intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => ` Mortgage: $${(ctx.parsed.y as number).toLocaleString('en-AU')}` } },
          },
          scales: {
            x: { ticks: { font: { size: 10 }, color: '#A09484' }, grid: { display: false } },
            y: { ticks: { callback: v => '$' + Math.round(Number(v) / 1000) + 'k', font: { size: 10 }, color: '#A09484' }, grid: { color: 'rgba(0,0,0,0.05)' } },
          },
        }} />
      </div>
      <p className="proj-note mt1">
        End date: {endDate} · {yrs.toFixed(1)} yrs remaining
        {clearedYr ? ` · Cleared in projection: ${clearedYr}` : ''}
      </p>
    </>
  )
}
