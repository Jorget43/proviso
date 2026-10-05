'use client'
import { Chart as ChartJS, BarElement, LinearScale, CategoryScale } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { fmtK } from '@/lib/formatting'
import { SF_LEVELS } from '@/lib/schoolFees'
import { crosshair, SCRUB_BASE, AXIS_TICKS, kTicks } from '@/lib/chartPlugins'
import ScrubChart from '@/components/ui/ScrubChart'
ChartJS.register(BarElement, LinearScale, CategoryScale)

interface SchoolFeeChartProps {
  labels:      string[]
  sfC1Arr:     number[]
  sfC2Arr:     number[]
  sfSibArr:    number[]
  sfTotalArr:  number[]
  sfC1Start:   number
  sfC1ExitIdx: number
  sfC2Start:   number
  sfC2ExitIdx: number
}

export default function SchoolFeeChart({ labels, sfC1Arr, sfC2Arr, sfSibArr, sfTotalArr, sfC1Start, sfC1ExitIdx, sfC2Start, sfC2ExitIdx }: SchoolFeeChartProps) {
  const totalC1   = sfC1Arr.reduce((s, v) => s + v, 0)
  const totalC2   = sfC2Arr.reduce((s, v) => s + v, 0)
  const totalSib  = sfSibArr.reduce((s, v) => s + v, 0)
  const grandTotal = sfTotalArr.reduce((s, v) => s + v, 0)

  const datasets = [
    { label: 'Child 1',          data: sfC1Arr,  backgroundColor: 'rgba(30,95,168,0.75)',  stack: 'a', borderRadius: 3 },
    { label: 'Child 2',          data: sfC2Arr,  backgroundColor: 'rgba(22,107,69,0.75)',  stack: 'a', borderRadius: 3 },
    { label: 'Sibling discount', data: sfSibArr, backgroundColor: 'rgba(186,117,23,0.4)',  stack: 'a' },
  ]
  const peakIdx = sfTotalArr.indexOf(Math.max(...sfTotalArr))

  return (
    <>
      <ScrubChart labels={labels} datasets={datasets} height={230} defaultIndex={peakIdx >= 0 ? peakIdx : undefined}>
        <Bar plugins={[crosshair]} data={{ labels, datasets }} options={{
          ...SCRUB_BASE,
          scales: {
            x: { stacked: true, ticks: AXIS_TICKS, grid: { display: false } },
            y: { stacked: true, ticks: { ...AXIS_TICKS, callback: kTicks }, grid: { color: 'rgba(0,0,0,0.05)' } },
          },
        }} />
      </ScrubChart>
      <div className="mini-stats four">
        {[
          { label: 'Child 1 total',  val: totalC1,   color: 'var(--blue)' },
          { label: 'Child 2 total',  val: totalC2,   color: 'var(--green)' },
          { label: 'Sibling discount', val: totalSib, color: 'var(--amber)' },
          { label: 'All fees',       val: grandTotal, color: 'var(--red)' },
        ].map(({ label, val, color }) => (
          <div key={label} className="mini-stat">
            <span>{label}</span>
            <strong style={{ color }}>{fmtK(val)}</strong>
          </div>
        ))}
      </div>
      <p className="proj-note" style={{ marginTop: '0.5rem' }}>
        C1: {sfC1Start} → {SF_LEVELS[sfC1ExitIdx]} · C2: {sfC2Start} → {SF_LEVELS[sfC2ExitIdx]}<br />
        Fees inflated from 2026 schedule. Sibling discount 15% on Child 2 tuition while both enrolled. CML $350/yr per family.
      </p>
    </>
  )
}
