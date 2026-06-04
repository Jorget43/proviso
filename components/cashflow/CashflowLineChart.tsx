'use client'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

interface CashflowLineChartProps {
  labels: string[]
  data: number[]
  color: string
  note?: string
}

export default function CashflowLineChart({ labels, data, color, note }: CashflowLineChartProps) {
  const bg = color + '12'

  return (
    <>
      <div className="chart-wrap" style={{ height: 240 }}>
        <Line
          data={{
            labels,
            datasets: [{
              label: 'Balance',
              data,
              borderColor: color,
              backgroundColor: bg,
              fill: true,
              tension: 0.35,
              pointRadius: 2,
              borderWidth: 2,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => ` Balance: $${(ctx.parsed.y as number).toLocaleString('en-AU')}`,
                },
              },
            },
            scales: {
              x: {
                ticks: { font: { size: 10 }, color: '#A09484' },
                grid: { display: false },
              },
              y: {
                ticks: {
                  callback: v => '$' + Math.round(Number(v) / 1000) + 'k',
                  font: { size: 10 },
                  color: '#A09484',
                },
                grid: { color: 'rgba(0,0,0,0.05)' },
              },
            },
          }}
        />
      </div>
      {note && <p className="proj-note mt1">{note}</p>}
    </>
  )
}
