'use client'
import { Chart as ChartJS, BarElement, LinearScale, CategoryScale } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { crosshair, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart from '@/components/ui/ScrubChart'
ChartJS.register(BarElement, LinearScale, CategoryScale)

interface IncExpProjChartProps {
  labels:     string[]
  incData:    number[]
  expData:    number[]
  phaseData:  number[]
  sfTotalData:number[]
  sfOn:       boolean
}

export default function IncExpProjChart({ labels, incData, expData, phaseData, sfTotalData, sfOn }: IncExpProjChartProps) {
  const c = useChartColors()
  const baseExp = expData.map((v, i) => v - phaseData[i] - (sfOn ? sfTotalData[i] : 0))
  const datasets = [
    { label: 'Income (after tax)', data: incData,   backgroundColor: c.a(c.green, 0.72),  stack: 'a' },
    { label: 'Everyday spending',  data: baseExp,   backgroundColor: c.a(c.red, 0.65),  stack: 'b' },
    { label: 'Life stage costs',   data: phaseData, backgroundColor: c.a(c.teal, 0.65), stack: 'b' },
    { label: 'School fees',        data: sfOn ? sfTotalData : Array(labels.length).fill(0), backgroundColor: c.a(c.amber, 0.6), stack: 'b' },
  ]

  return (
    <ScrubChart labels={labels} datasets={datasets} height={230}>
      <Bar plugins={[crosshair]} data={{ labels, datasets }} options={{
        ...SCRUB_BASE,
        scales: {
          x: { ticks: axisTicks(c), grid: { display: false } },
          y: { stacked: true, ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
        },
      }} />
    </ScrubChart>
  )
}
