'use client'
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale, CategoryScale, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { CombinedRow, SuperRow } from '@/lib/super'
import { crosshair, SCRUB_BASE, AXIS_TICKS, kTicks } from '@/lib/chartPlugins'
import ScrubChart from '@/components/ui/ScrubChart'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler)

interface Props {
  combined:              CombinedRow[]
  person1Rows:           SuperRow[]
  person2Rows:           SuperRow[] | null
  person1RetirementYear: number
  person2RetirementYear: number | null
  person1Name:           string
  person2Name:           string
}

export default function SuperBalanceChart({
  combined, person1Rows, person2Rows, person1RetirementYear, person2RetirementYear, person1Name, person2Name,
}: Props) {
  const labels    = combined.map(c => String(c.year))
  const hasPerson2  = person2Rows !== null && person2Rows.length > 0

  // Build year-indexed lookups for person 1 and person 2
  const person1ByYear: Record<number, number> = {}
  for (const r of person1Rows) person1ByYear[r.year] = r.balance
  const person2ByYear: Record<number, number> = {}
  if (person2Rows) for (const r of person2Rows) person2ByYear[r.year] = r.balance

  const datasets = hasPerson2
    ? [
        {
          label: person1Name,
          data: combined.map(c => Math.round(person1ByYear[c.year] ?? 0)),
          borderColor: 'rgba(30,95,168,0.85)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
        {
          label: person2Name,
          data: combined.map(c => Math.round(person2ByYear[c.year] ?? 0)),
          borderColor: 'rgba(139,92,246,0.85)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
        {
          label: 'Combined',
          data: combined.map(c => Math.round(c.total)),
          borderColor: 'rgba(22,163,74,0.9)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
        {
          label: "Combined (today's $)",
          data: combined.map(c => Math.round(c.totalPV)),
          borderColor: 'rgba(22,163,74,0.25)',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
      ]
    : [
        {
          label: 'Balance',
          data: combined.map(c => Math.round(c.person1Balance)),
          borderColor: 'rgba(30,95,168,0.85)',  // readout colour; the line is drawn per segment
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
          segment: {
            borderColor: (ctx: { p1DataIndex: number }) => {
              const year = combined[ctx.p1DataIndex]?.year ?? 0
              return year >= person1RetirementYear
                ? 'rgba(138,82,8,0.85)'
                : 'rgba(30,95,168,0.85)'
            },
          },
        },
        {
          label: "Today's dollars (PV)",
          data: combined.map(c => Math.round(c.totalPV)),
          borderColor: 'rgba(30,95,168,0.3)',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
      ]

  const options = {
    ...SCRUB_BASE,
    scales: {
      x: {
        ticks: {
          ...AXIS_TICKS,
          maxTicksLimit: 12,
          callback: (_: unknown, i: number) => {
            const c = combined[i]
            if (!c) return ''
            if (c.year === person1RetirementYear) return `↓${c.year}`
            if (person2RetirementYear && c.year === person2RetirementYear) return `↓${c.year}`
            return i % 5 === 0 ? String(c.year) : ''
          },
        },
        grid: { color: 'rgba(50,42,28,0.06)' },
      },
      y: {
        ticks: { ...AXIS_TICKS, callback: kTicks },
        grid: { color: 'rgba(50,42,28,0.06)' },
      },
    },
  }
  const retireIdx = combined.findIndex(c => c.year === person1RetirementYear)

  return (
    <ScrubChart labels={labels} datasets={datasets} height={280} defaultIndex={retireIdx >= 0 ? retireIdx : undefined}>
      <Line data={{ labels, datasets }} options={options} plugins={[crosshair]} />
    </ScrubChart>
  )
}
