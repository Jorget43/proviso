'use client'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

interface NetWorthChartProps {
  labels:    string[]
  nwData:    number[]
  nwNoFees:  number[] | null
  investData:number[]
  cashData:  number[]
  sfOn:      boolean
}

export default function NetWorthChart({ labels, nwData, nwNoFees, investData, cashData, sfOn }: NetWorthChartProps) {
  const datasets: object[] = [
    { label: sfOn ? 'Net worth (with school fees)' : 'Net worth', data: nwData, borderColor: '#166B45', backgroundColor: 'rgba(22,107,69,0.07)', fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 3 },
    { label: 'Investments', data: investData, borderColor: '#5235A8', backgroundColor: 'rgba(82,53,168,0.04)', fill: true, tension: 0.4, borderWidth: 1.5, pointRadius: 2, borderDash: [5, 4] },
    { label: 'Cash', data: cashData, borderColor: '#1E5FA8', tension: 0.4, borderWidth: 1.5, pointRadius: 2, borderDash: [2, 4] },
  ]
  if (sfOn && nwNoFees) {
    datasets.splice(1, 0, { label: 'Net worth (no school fees)', data: nwNoFees, borderColor: 'rgba(22,107,69,0.4)', borderDash: [6, 3], borderWidth: 1.8, pointRadius: 2, fill: false, tension: 0.4 })
  }

  return (
    <div className="chart-wrap" style={{ height: 260 }}>
      <Line data={{ labels, datasets: datasets as never[] }} options={{
        responsive: true, maintainAspectRatio: false,
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
