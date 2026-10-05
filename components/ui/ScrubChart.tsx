'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart as ChartJS } from 'chart.js'
import { fmtK } from '@/lib/formatting'

// Wraps a Chart.js chart so it reads well on a phone:
//  • drag sideways across it (or hover with a mouse) to move through the
//    years; dragging up and down still scrolls the page (touch-action: pan-y)
//  • the selected point's values show in a fixed readout above the chart
//    instead of a floating tooltip that covers it
//  • the readout doubles as the legend — tap an item to hide that series
// The chart inside should set `events: []` and turn off its own legend and
// tooltip; this component drives the active point (and so the crosshair).

export interface ScrubSeries {
  label?:           string
  data:             (number | null)[]
  borderColor?:     unknown
  backgroundColor?: unknown
  /** false to leave a series (e.g. a fixed threshold line) out of the readout */
  readout?:         boolean
}

interface ScrubChartProps {
  labels:        string[]
  datasets:      ScrubSeries[]
  height:        number
  format?:       (v: number) => string
  /** index selected before the user touches the chart; defaults to the last */
  defaultIndex?: number
  children:      React.ReactNode
}

function colorAt(c: unknown, i: number): string | undefined {
  if (Array.isArray(c)) return typeof c[i] === 'string' ? c[i] : undefined
  return typeof c === 'string' ? c : undefined
}

export default function ScrubChart({ labels, datasets, height, format = fmtK, defaultIndex, children }: ScrubChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [hidden, setHidden] = useState<Set<number>>(new Set())

  const last = Math.max(0, labels.length - 1)
  const idx = Math.min(picked ?? defaultIndex ?? last, last)

  const chartOf = () => {
    const canvas = wrapRef.current?.querySelector('canvas')
    return canvas ? ChartJS.getChart(canvas) : undefined
  }

  // Keep the chart's highlighted point and hidden series in step with ours.
  // Runs after every render: react-chartjs-2 rebuilds the chart's data when
  // its props change, so this re-applies on top.
  useEffect(() => {
    const chart = chartOf()
    if (!chart) return
    let changed = false
    datasets.forEach((_, k) => {
      const visible = !hidden.has(k)
      if (chart.isDatasetVisible(k) !== visible) { chart.setDatasetVisibility(k, visible); changed = true }
    })
    if (changed) chart.update('none')
    const active = datasets.flatMap((d, k) =>
      !hidden.has(k) && d.data[idx] != null && chart.getDatasetMeta(k).data[idx] ? [{ datasetIndex: k, index: idx }] : [])
    chart.setActiveElements(active)
    chart.draw()
  })

  function pick(clientX: number) {
    const chart = chartOf()
    const scale = chart?.scales.x
    if (!chart || !scale) return
    const rect = chart.canvas.getBoundingClientRect()
    const i = Math.round(Number(scale.getValueForPixel(clientX - rect.left)))
    if (Number.isFinite(i)) setPicked(Math.max(0, Math.min(last, i)))
  }

  const toggle = (k: number) => setHidden(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })

  // Series that are empty throughout (e.g. school fees when switched off) add
  // nothing to the readout.
  const items = datasets
    .map((d, k) => ({ d, k }))
    .filter(({ d }) => d.readout !== false && d.data.some(v => v != null && v !== 0))

  return (
    <div className="scrub">
      <div className="scrub-readout" aria-live="polite">
        <div className="scrub-year">{labels[idx]}</div>
        <div className="scrub-items">
          {items.map(({ d, k }) => {
            const v = d.data[idx]
            const off = hidden.has(k)
            return (
              <button key={k} type="button" className={`scrub-item${off ? ' off' : ''}`}
                onClick={() => toggle(k)} aria-pressed={!off}
                title={off ? `Show ${d.label}` : `Hide ${d.label}`}>
                <span className="scrub-dot" style={{ background: colorAt(d.borderColor, idx) ?? colorAt(d.backgroundColor, idx) ?? 'var(--t3)' }} />
                <span className="scrub-label">{d.label}</span>
                <strong>{v == null ? '—' : format(v)}</strong>
              </button>
            )
          })}
        </div>
      </div>
      <div
        ref={wrapRef}
        className="chart-wrap scrub-area"
        style={{ height }}
        onPointerDown={e => pick(e.clientX)}
        onPointerMove={e => { if (e.pointerType === 'mouse' || e.buttons) pick(e.clientX) }}
      >
        {children}
      </div>
      <div className="scrub-hint">
        <span className="scrub-hint-touch">Drag across the chart · tap a label to hide it</span>
        <span className="scrub-hint-mouse">Move across the chart to see each year · click a label to hide it</span>
      </div>
    </div>
  )
}
