'use client'
import { Chart as ChartJS, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { fmtK } from '@/lib/formatting'
import { SF_LEVELS } from '@/lib/schoolFees'
import { crosshair } from '@/lib/chartPlugins'
ChartJS.register(BarElement, LinearScale, CategoryScale, Tooltip, Legend)

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

  return (
    <>
      <div className="chart-wrap" style={{ height: 220 }}>
        <Bar plugins={[crosshair]} data={{
          labels,
          datasets: [
            { label: 'Child 1',             data: sfC1Arr,  backgroundColor: 'rgba(30,95,168,0.75)',  stack: 'a', borderRadius: 3 },
            { label: 'Child 2 (after disc.)', data: sfC2Arr, backgroundColor: 'rgba(22,107,69,0.75)', stack: 'a', borderRadius: 3 },
            { label: 'Sibling saving',      data: sfSibArr, backgroundColor: 'rgba(186,117,23,0.4)', stack: 'a' },
          ],
        }} options={{
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index' as const, intersect: false },
          plugins: {
            legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: '#6A5F4A', boxWidth: 8, boxHeight: 8 } },
            tooltip: { callbacks: { label: ctx => { const v = ctx.parsed.y ?? 0; return v > 0 ? ` ${ctx.dataset.label}: $${v.toLocaleString('en-AU')}` : '' } } },
          },
          scales: {
            x: { stacked: true, ticks: { font: { size: 10 }, color: '#A09484' }, grid: { display: false } },
            y: { stacked: true, ticks: { callback: v => '$' + Math.round(Number(v) / 1000) + 'k', font: { size: 10 }, color: '#A09484' }, grid: { color: 'rgba(0,0,0,0.05)' } },
          },
        }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginTop: '1rem' }}>
        {[
          { label: 'Child 1 total',  val: totalC1,   color: 'var(--blue)' },
          { label: 'Child 2 total',  val: totalC2,   color: 'var(--green)' },
          { label: 'Sibling saving', val: totalSib,  color: 'var(--amber)' },
          { label: 'Grand total',    val: grandTotal, color: 'var(--red)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '0.6rem 0.75rem' }}>
            <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: 3 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-dm-serif,serif)', fontSize: '1.1rem', color }}>{fmtK(val)}</div>
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
