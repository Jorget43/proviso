'use client'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { crosshair, SCRUB_BASE, AXIS_TICKS, kTicks } from '@/lib/chartPlugins'
import ScrubChart from '@/components/ui/ScrubChart'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler)

interface MortPaydownChartProps {
  labels:   string[]
  mortData: number[]
  endDate:  string
}

export default function MortPaydownChart({ labels, mortData, endDate }: MortPaydownChartProps) {
  const end = new Date(endDate)
  const now = new Date()
  const yrs = Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
  const datasets = [{ label: 'Home loan left', data: mortData, borderColor: '#9B2525', backgroundColor: 'rgba(155,37,37,0.07)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 }]

  return (
    <>
      <ScrubChart labels={labels} datasets={datasets} height={210} defaultIndex={0}>
        <Line data={{ labels, datasets }} plugins={[crosshair]} options={{
          ...SCRUB_BASE,
          scales: {
            x: { ticks: AXIS_TICKS, grid: { display: false } },
            y: { min: 0, ticks: { ...AXIS_TICKS, callback: kTicks }, grid: { color: 'rgba(0,0,0,0.05)' } },
          },
        }} />
      </ScrubChart>
      {endDate && !Number.isNaN(end.getTime()) && (
        <p className="proj-note mt1">
          Your loan&rsquo;s scheduled end date is {end.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })} ({yrs.toFixed(1)} years away).
        </p>
      )}
    </>
  )
}
