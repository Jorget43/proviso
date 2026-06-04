'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { GRACE_FTE } from '@/lib/constants'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

interface GraceIncomeChartProps {
  labels:        string[]
  graceData:     number[]
  leaveYrs:      number[]
  graceGrowthRate: number
}

export default function GraceIncomeChart({ labels, graceData, leaveYrs, graceGrowthRate }: GraceIncomeChartProps) {
  const leaveSet = new Set(leaveYrs)
  const g = graceGrowthRate / 100
  const barColors = labels.map(yr => leaveSet.has(parseInt(yr)) ? 'rgba(155,37,96,0.75)' : 'rgba(22,107,69,0.75)')
  const fteRef = labels.map((_, i) => Math.round(GRACE_FTE * Math.pow(1 + g * 0.5, i)))

  return (
    <div className="chart-wrap" style={{ height: 190 }}>
      <Chart type="bar" data={{
        labels,
        datasets: [
          { type: 'bar' as const, label: "Grace's income", data: graceData, backgroundColor: barColors, borderRadius: 3, order: 2 },
          { type: 'line' as const, label: 'FTE reference', data: fteRef, borderColor: 'rgba(160,148,132,0.45)', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, fill: false, order: 1 },
        ],
      }} options={{
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: '#6A5F4A', boxWidth: 8, boxHeight: 8 } },
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
