'use client'
import { Chart as ChartJS, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { crosshair } from '@/lib/chartPlugins'
ChartJS.register(BarElement, LinearScale, CategoryScale, Tooltip, Legend)

interface IncExpProjChartProps {
  labels:     string[]
  incData:    number[]
  expData:    number[]
  phaseData:  number[]
  sfTotalData:number[]
  sfOn:       boolean
}

export default function IncExpProjChart({ labels, incData, expData, phaseData, sfTotalData, sfOn }: IncExpProjChartProps) {
  const baseExp = expData.map((v, i) => v - phaseData[i] - (sfOn ? sfTotalData[i] : 0))

  return (
    <div className="chart-wrap" style={{ height: 210 }}>
      <Bar plugins={[crosshair]} data={{
        labels,
        datasets: [
          { label: 'Annual income',     data: incData,   backgroundColor: 'rgba(22,107,69,0.72)',  stack: 'a' },
          { label: 'Base expenses',     data: baseExp,   backgroundColor: 'rgba(155,37,37,0.65)',  stack: 'b' },
          { label: 'Life phase costs',  data: phaseData, backgroundColor: 'rgba(14,107,107,0.65)', stack: 'b' },
          { label: 'School fees',       data: sfOn ? sfTotalData : Array(labels.length).fill(0), backgroundColor: 'rgba(138,82,8,0.6)', stack: 'b' },
        ],
      }} options={{
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: '#6A5F4A', boxWidth: 8, boxHeight: 8 } },
          tooltip: { callbacks: { label: ctx => { const v = ctx.parsed.y ?? 0; return v > 0 ? ` ${ctx.dataset.label}: $${v.toLocaleString('en-AU')}` : '' } } },
        },
        scales: {
          x: { ticks: { font: { size: 10 }, color: '#A09484' }, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => '$' + Math.round(Number(v) / 1000) + 'k', font: { size: 10 }, color: '#A09484' }, grid: { color: 'rgba(0,0,0,0.05)' } },
        },
      }} />
    </div>
  )
}
