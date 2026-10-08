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
import { crosshair, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart from '@/components/ui/ScrubChart'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler)

interface CashflowLineChartProps {
  labels: string[]
  data: number[]
  tone: 'green' | 'pink'
  note?: string
}

export default function CashflowLineChart({ labels, data, tone, note }: CashflowLineChartProps) {
  const c = useChartColors()
  const color = c[tone]
  const datasets = [{
    label: 'Cash in the bank',
    data,
    borderColor: color,
    backgroundColor: c.a(color, 0.07),
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
              x: { ticks: axisTicks(c), grid: { display: false } },
              y: { ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
            },
          }}
        />
      </ScrubChart>
      {note && <p className="proj-note mt1">{note}</p>}
    </>
  )
}
