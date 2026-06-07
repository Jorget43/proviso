'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Chart } from 'react-chartjs-2'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

interface PersonIncomeChartProps {
  labels:      string[]
  person1Data: number[]
  person2Data: number[]
  person1Name: string
  person2Name: string
  leaveYrs:    number[]
  person1FTE:  number
  person2FTE:  number
  person1Growth: number
  person2Growth: number
}

export default function GraceIncomeChart({
  labels, person1Data, person2Data, person1Name, person2Name,
  leaveYrs, person1FTE, person2FTE, person1Growth, person2Growth,
}: PersonIncomeChartProps) {
  const leaveSet  = new Set(leaveYrs)
  const g1 = person1Growth / 100
  const g2 = person2Growth / 100

  const p2Colors = labels.map(yr => leaveSet.has(parseInt(yr)) ? 'rgba(155,37,96,0.75)' : 'rgba(22,107,69,0.75)')
  const fte1Ref  = labels.map((_, i) => Math.round(person1FTE * Math.pow(1 + g1, i + 1)))
  const fte2Ref  = labels.map((_, i) => Math.round(person2FTE * Math.pow(1 + g2 * 0.5, i)))

  return (
    <div className="chart-wrap" style={{ height: 210 }}>
      <Chart type="bar" data={{
        labels,
        datasets: [
          { type: 'bar' as const,  label: person1Name,         data: person1Data, backgroundColor: 'rgba(30,95,168,0.72)', borderRadius: 3, order: 2 },
          { type: 'bar' as const,  label: person2Name,         data: person2Data, backgroundColor: p2Colors,               borderRadius: 3, order: 3 },
          { type: 'line' as const, label: `${person1Name} FTE`, data: fte1Ref,    borderColor: 'rgba(30,95,168,0.35)',  borderDash: [4,4], borderWidth: 1.5, pointRadius: 0, fill: false, order: 1 },
          { type: 'line' as const, label: `${person2Name} FTE`, data: fte2Ref,    borderColor: 'rgba(160,148,132,0.45)', borderDash: [4,4], borderWidth: 1.5, pointRadius: 0, fill: false, order: 0 },
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
