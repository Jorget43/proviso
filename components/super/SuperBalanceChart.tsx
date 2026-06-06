'use client'
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { CombinedRow, SuperRow } from '@/lib/super'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler)

interface Props {
  combined:            CombinedRow[]
  jorgeRows:           SuperRow[]
  graceRows:           SuperRow[] | null
  jorgeRetirementYear: number
  graceRetirementYear: number | null
}

export default function SuperBalanceChart({
  combined, jorgeRows, graceRows, jorgeRetirementYear, graceRetirementYear,
}: Props) {
  const labels    = combined.map(c => String(c.year))
  const hasGrace  = graceRows !== null && graceRows.length > 0

  // Build year-indexed lookups for Jorge and Grace
  const jorgeByYear: Record<number, number> = {}
  for (const r of jorgeRows) jorgeByYear[r.year] = r.balance
  const graceByYear: Record<number, number> = {}
  if (graceRows) for (const r of graceRows) graceByYear[r.year] = r.balance

  const datasets = hasGrace
    ? [
        {
          label: 'Jorge',
          data: combined.map(c => Math.round(jorgeByYear[c.year] ?? 0)),
          borderColor: 'rgba(30,95,168,0.85)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
        {
          label: 'Grace',
          data: combined.map(c => Math.round(graceByYear[c.year] ?? 0)),
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
          data: combined.map(c => Math.round(c.jorgeBalance)),
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
          segment: {
            borderColor: (ctx: { p1DataIndex: number }) => {
              const year = combined[ctx.p1DataIndex]?.year ?? 0
              return year >= jorgeRetirementYear
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
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        labels: { font: { size: 11 }, color: '#6A5F4A', boxWidth: 20 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) => {
            const v = ctx.parsed.y
            const label = ctx.dataset.label ?? ''
            if (v >= 1_000_000) return `${label}: $${(v / 1_000_000).toFixed(2)}M`
            return `${label}: $${v.toLocaleString('en-AU')}`
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#A09484',
          font: { size: 10 },
          maxTicksLimit: 12,
          callback: (_: unknown, i: number) => {
            const c = combined[i]
            if (!c) return ''
            if (c.year === jorgeRetirementYear) return `↓${c.year}`
            if (graceRetirementYear && c.year === graceRetirementYear) return `↓${c.year}`
            return i % 5 === 0 ? String(c.year) : ''
          },
        },
        grid: { color: 'rgba(50,42,28,0.06)' },
      },
      y: {
        ticks: {
          color: '#A09484',
          font: { size: 10 },
          callback: (v: unknown) => {
            const n = Number(v)
            if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
            if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
            return `$${n}`
          },
        },
        grid: { color: 'rgba(50,42,28,0.06)' },
      },
    },
  }

  return (
    <div className="chart-wrap" style={{ height: 300 }}>
      <Line data={{ labels, datasets }} options={options} />
    </div>
  )
}
