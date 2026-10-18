'use client'
// School fees year by year, stacked by child (any number, eldest first), with
// the yearly family fee on top. Each child's bar is after any sibling
// discount and includes entry fees (@proviso/core/schoolFees).
import { Chart as ChartJS, BarElement, LinearScale, CategoryScale } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { fmtK } from '@proviso/core/formatting'
import { crosshair, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart from '@/components/ui/ScrubChart'
import { overlayDatasets, type Overlay } from '@/lib/scenarioOverlay'
ChartJS.register(BarElement, LinearScale, CategoryScale)

interface SchoolFeeChartProps {
  labels:      string[]
  /** Each child's fees by year, eldest first. */
  childArrs:   number[][]
  childNames:  string[]
  familyArr:   number[]
  sibArr:      number[]
  totalArr:    number[]
  /** Fee rises a year, %. */
  inflation:   number
  /** Scenarios' total fees each year, as lines over the plan's bars. */
  overlays?:   Overlay[]
}

const CHILD_COLOURS = ['blue', 'green', 'purple', 'pink', 'teal', 'amber'] as const

export default function SchoolFeeChart({ labels, childArrs, childNames, familyArr, sibArr, totalArr, inflation, overlays }: SchoolFeeChartProps) {
  const c = useChartColors()
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
  const datasets: Record<string, unknown>[] = [
    ...childArrs.map((data, i) => ({ label: childNames[i], data, backgroundColor: c.a(c[CHILD_COLOURS[i % CHILD_COLOURS.length]], 0.75), stack: 'a', borderRadius: 3 })),
    { label: 'Family fee', data: familyArr, backgroundColor: c.a(c.amber, 0.45), stack: 'a' },
    ...overlayDatasets(overlays, c, labels.length, totalArr, 0, 'line'),
  ]
  const peakIdx = totalArr.indexOf(Math.max(...totalArr))
  const tiles = [
    ...childArrs.map((a, i) => ({ label: childNames[i], val: sum(a), color: `var(--${CHILD_COLOURS[i % CHILD_COLOURS.length]})` })),
    ...(sum(sibArr) > 0 ? [{ label: 'Saved by sibling discounts', val: sum(sibArr), color: 'var(--green)' }] : []),
    { label: 'All fees', val: sum(totalArr), color: 'var(--red)' },
  ]

  return (
    <>
      <ScrubChart labels={labels} datasets={datasets as never[]} height={230} defaultIndex={peakIdx >= 0 ? peakIdx : undefined}>
        <Bar plugins={[crosshair]} data={{ labels, datasets: datasets as never[] }} options={{
          ...SCRUB_BASE,
          scales: {
            x: { stacked: true, ticks: axisTicks(c), grid: { display: false } },
            y: { stacked: true, ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
          },
        }} />
      </ScrubChart>
      <div className="mini-stats fit">
        {tiles.map(({ label, val, color }) => (
          <div key={label} className="mini-stat">
            <span>{label}</span>
            <strong style={{ color }}>{fmtK(val)}</strong>
          </div>
        ))}
      </div>
      <p className="proj-note" style={{ marginTop: '0.5rem' }}>
        Fees rise {inflation}% a year from 2026 prices and stop after Year 12. Each child&rsquo;s bar is after any sibling discount and includes entry fees; your fee rules and each child&rsquo;s schools are in What if? &rarr; Plans.
      </p>
    </>
  )
}
