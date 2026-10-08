'use client'
import { useChartColors } from '@/lib/chartTheme'
import {
  Chart as ChartJS,
  BarElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { CATS, CAT_COLORS } from '@proviso/core/constants'

ChartJS.register(BarElement, LinearScale, CategoryScale, Tooltip)

interface IncVsExpChartProps {
  totalInc: number
  catMonthly: Record<string, number>
}

export default function IncVsExpChart({ totalInc, catMonthly }: IncVsExpChartProps) {
  const c = useChartColors()
  return (
    <div className="chart-wrap" style={{ height: 200 }}>
      <Bar
        data={{
          labels: ['Income', 'Expenses'],
          datasets: [
            {
              label: 'Income',
              data: [Math.round(totalInc), 0],
              backgroundColor: c.green,
              stack: 'a',
            },
            ...CATS.map((cat, i) => ({
              label: cat,
              data: [0, Math.round(catMonthly[cat] ?? 0)],
              backgroundColor: CAT_COLORS[i],
              stack: 'a',
            })),
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const v = ctx.parsed.y ?? 0
                  return v > 0 ? ` ${ctx.dataset.label}: $${v.toLocaleString('en-AU')}` : ''
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              ticks: { font: { size: 11 }, color: c.t3 },
              grid: { display: false },
            },
            y: {
              stacked: true,
              ticks: {
                callback: v => '$' + Math.round(Number(v) / 1000) + 'k',
                font: { size: 10 },
                color: c.t3,
              },
              grid: { color: c.grid },
            },
          },
        }}
      />
    </div>
  )
}
