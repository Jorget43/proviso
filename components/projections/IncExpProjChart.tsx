'use client'
import { Chart as ChartJS, BarElement, LinearScale, CategoryScale } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { crosshair, SCRUB_BASE, AXIS_TICKS, kTicks } from '@/lib/chartPlugins'
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
  const baseExp = expData.map((v, i) => v - phaseData[i] - (sfOn ? sfTotalData[i] : 0))
  const datasets = [
    { label: 'Income (after tax)', data: incData,   backgroundColor: 'rgba(22,107,69,0.72)',  stack: 'a' },
    { label: 'Everyday spending',  data: baseExp,   backgroundColor: 'rgba(155,37,37,0.65)',  stack: 'b' },
    { label: 'Life stage costs',   data: phaseData, backgroundColor: 'rgba(14,107,107,0.65)', stack: 'b' },
    { label: 'School fees',        data: sfOn ? sfTotalData : Array(labels.length).fill(0), backgroundColor: 'rgba(138,82,8,0.6)', stack: 'b' },
  ]

  return (
    <ScrubChart labels={labels} datasets={datasets} height={230}>
      <Bar plugins={[crosshair]} data={{ labels, datasets }} options={{
        ...SCRUB_BASE,
        scales: {
          x: { ticks: AXIS_TICKS, grid: { display: false } },
          y: { stacked: true, ticks: { ...AXIS_TICKS, callback: kTicks }, grid: { color: 'rgba(0,0,0,0.05)' } },
        },
      }} />
    </ScrubChart>
  )
}
