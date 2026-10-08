'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { fmt } from '@proviso/core/formatting'
import { crosshair, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart from '@/components/ui/ScrubChart'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale)

interface SpendHistoryChartProps {
  spendByMonth:   Record<string, number>
  budgetMonthly:  number
}

export default function SpendHistoryChart({ spendByMonth, budgetMonthly }: SpendHistoryChartProps) {
  const c = useChartColors()
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

  const datasets = [
    { type: 'bar'  as const, label: 'Actual spend', data,    backgroundColor: c.a(c.blue, 0.65), borderRadius: 3 },
    { type: 'line' as const, label: 'Budget',        data: budLine, borderColor: c.a(c.red, 0.7), borderDash: [4, 3], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false },
  ]

  return (
    <ScrubChart labels={labels} datasets={datasets} height={200} format={v => fmt(v)}>
      <Chart type="bar" plugins={[crosshair]} data={{ labels, datasets }} options={{
        ...SCRUB_BASE,
        scales: {
          x: { ticks: axisTicks(c), grid: { display: false } },
          y: { ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
        },
      }} />
    </ScrubChart>
  )
}
