'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Chart } from 'react-chartjs-2'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

interface SpendHistoryChartProps {
  spendByMonth:   Record<string, number>
  budgetMonthly:  number
}

export default function SpendHistoryChart({ spendByMonth, budgetMonthly }: SpendHistoryChartProps) {
  const sortedMonths = Object.keys(spendByMonth).sort()
  if (!sortedMonths.length) {
    return <p className="small" style={{ color: 'var(--t3)', textAlign: 'center', padding: '1rem 0' }}>No actuals data yet</p>
  }

  const labels = sortedMonths.map(ym => {
    const [y, m] = ym.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
  })
  const data    = sortedMonths.map(m => Math.round(spendByMonth[m]))
  const budLine = Array(labels.length).fill(Math.round(budgetMonthly))

  return (
    <div className="chart-wrap" style={{ height: 200 }}>
      <Chart type="bar" data={{
        labels,
        datasets: [
          { type: 'bar'  as const, label: 'Actual spend', data,    backgroundColor: 'rgba(30,95,168,0.65)', borderRadius: 3 },
          { type: 'line' as const, label: 'Budget',        data: budLine, borderColor: 'rgba(155,37,37,0.7)', borderDash: [4, 3], borderWidth: 1.5, pointRadius: 0, fill: false },
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
