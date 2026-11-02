'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Chart as ChartJS } from 'chart.js'
import { fmtK } from '@proviso/core/formatting'

// Wraps a Chart.js chart so it reads well on a phone:
//  • drag sideways across it (or hover with a mouse) to move through the
//    years; dragging up and down still scrolls the page (touch-action: pan-y)
//  • the selected point's values show in a fixed readout above the chart
//    instead of a floating tooltip that covers it
//  • the readout doubles as the legend — tap an item to hide that series
//    (series marked `startHidden` begin hidden: tap to show them)
//  • inside a YearWindow, only those years are drawn and the y axis fits them
// The chart inside should set `events: []` and turn off its own legend and
// tooltip; this component drives the active point (and so the crosshair).

export interface ScrubSeries {
  label?:           string
  data:             (number | null)[]
  borderColor?:     unknown
  backgroundColor?: unknown
  /** false to leave a series (e.g. a fixed threshold line) out of the readout */
  readout?:         boolean
  /** How this series' value reads (default: the chart's format, e.g. $12k). */
  format?:          (v: number) => string
  /** The plan's values: the readout adds the difference from them (scenarios). */
  compareTo?:       (number | null)[]
  /** Begins hidden (a detail line): its readout item shows it when tapped. */
  startHidden?:     boolean
  /** Listed in the smaller second row of the readout. */
  detail?:          boolean
  /** A short name drawn at the line's right-hand end (endLabels plugin). */
  endLabel?:        string
}

/** The years shown on every chart inside it (inclusive); null shows them all. */
export const YearWindow = createContext<{ from: number; to: number } | null>(null)

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
  // Series the user has tapped, by label: shown if it started hidden, hidden
  // otherwise. Keyed by label so a scenario coming or going doesn't move it
  // onto another series.
  const [toggled, setToggled] = useState<Set<string>>(new Set())
  const isHidden = (d: ScrubSeries, k: number) => !!d.startHidden !== toggled.has(d.label ?? String(k))

  const win = useContext(YearWindow)
  let lo = 0, hi = Math.max(0, labels.length - 1)
  if (win) {
    const first = labels.findIndex(l => Number(l) >= win.from)
    const lastIn = labels.findLastIndex(l => Number(l) <= win.to)
    if (first >= 0 && lastIn >= first) { lo = first; hi = lastIn }
  }
  const idx = Math.max(lo, Math.min(picked ?? defaultIndex ?? hi, hi))

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
    datasets.forEach((d, k) => {
      const visible = !isHidden(d, k)
      if (chart.isDatasetVisible(k) !== visible) { chart.setDatasetVisibility(k, visible); changed = true }
    })
    const x = chart.options.scales?.x as { min?: unknown; max?: unknown } | undefined
    const [min, max] = win ? [labels[lo], labels[hi]] : [undefined, undefined]
    if (x && (x.min !== min || x.max !== max)) { x.min = min; x.max = max; changed = true }
    // Stop the animation react-chartjs-2 just started from its own update:
    // it would carry on moving points to where they sat before the window.
    if (changed) { chart.stop(); chart.update('none') }
    const active = datasets.flatMap((d, k) =>
      !isHidden(d, k) && d.data[idx] != null && chart.getDatasetMeta(k).data[idx] ? [{ datasetIndex: k, index: idx }] : [])
    chart.setActiveElements(active)
    chart.draw()
  })

  function pick(clientX: number) {
    const chart = chartOf()
    const scale = chart?.scales.x
    if (!chart || !scale) return
    const rect = chart.canvas.getBoundingClientRect()
    const i = Math.round(Number(scale.getValueForPixel(clientX - rect.left)))
    if (Number.isFinite(i)) setPicked(Math.max(lo, Math.min(hi, i)))
  }

  const toggle = (key: string) => setToggled(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
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
        {[items.filter(({ d }) => !d.detail), items.filter(({ d }) => d.detail)].map((row, r) => row.length > 0 && (
          <div key={r} className={`scrub-items${r ? ' detail' : ''}`}>
            {row.map(({ d, k }) => {
              const v = d.data[idx]
              const base = d.compareTo?.[idx]
              const diff = v != null && base != null ? v - base : null
              const off = isHidden(d, k)
              return (
                <button key={k} type="button" className={`scrub-item${off ? ' off' : ''}`}
                  onClick={() => toggle(d.label ?? String(k))} aria-pressed={!off}
                  title={off ? `Show ${d.label}` : `Hide ${d.label}`}>
                  <span className="scrub-dot" style={{ background: colorAt(d.borderColor, idx) ?? colorAt(d.backgroundColor, idx) ?? 'var(--t3)' }} />
                  <span className="scrub-label">{d.label}</span>
                  <strong>{v == null ? '—' : (d.format ?? format)(v)}</strong>
                  {diff !== null && (
                    <small className={`scrub-diff${diff > 0 ? ' up' : diff < 0 ? ' down' : ''}`}>
                      {Math.abs(diff) < 1 ? 'same as plan' : `${diff > 0 ? '+' : '−'}${(d.format ?? format)(Math.abs(diff)).replace(/^[+−-]/, '')} vs plan`}
                    </small>
                  )}
                </button>
              )
            })}
          </div>
        ))}
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
