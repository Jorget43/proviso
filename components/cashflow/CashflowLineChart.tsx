'use client'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { crosshair, SCRUB_BASE, AXIS_TICKS, kTicks } from '@/lib/chartPlugins'
import ScrubChart from '@/components/ui/ScrubChart'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler)

interface CashflowLineChartProps {
  labels: string[]
  data: number[]
  color: string
  note?: string
}

export default function CashflowLineChart({ labels, data, color, note }: CashflowLineChartProps) {
  const datasets = [{
    label: 'Cash in the bank',
    data,
    borderColor: color,
    backgroundColor: color + '12',
    fill: true,
    tension: 0.35,
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2,
  }]

  return (
    <>
      <ScrubChart labels={labels} datasets={datasets} height={240}>
        <Line
          plugins={[crosshair]}
          data={{ labels, datasets }}
          options={{
            ...SCRUB_BASE,
            scales: {
              x: { ticks: AXIS_TICKS, grid: { display: false } },
              y: { ticks: { ...AXIS_TICKS, callback: kTicks }, grid: { color: 'rgba(0,0,0,0.05)' } },
            },
          }}
        />
      </ScrubChart>
      {note && <p className="proj-note mt1">{note}</p>}
    </>
  )
}
