// The maths behind ScrubChart, kept apart from React so it's tested in Node:
// the value scale, where each year sits, the line paths and which year a
// finger is over.

export interface Plot {
  width:  number
  height: number
  /** Room on the left for the value labels. */
  left:   number
  right:  number
  top:    number
  bottom: number
}

export interface Scale {
  min:   number
  max:   number
  /** Three values to label: the bottom, the middle and the top. */
  ticks: number[]
}

/** Rounds up to 1, 2, 2.5 or 5 times a power of ten, so the axis reads cleanly. */
export function niceCeil(v: number): number {
  if (v <= 0) return 0
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  return ([1, 2, 2.5, 5, 10].find(m => m * p >= v - 1e-9) ?? 10) * p
}

/** The value scale for every series shown: starts at zero unless something goes below it. */
export function scaleFor(series: (number | null)[][]): Scale {
  const values = series.flat().filter((v): v is number => v !== null && Number.isFinite(v))
  const hi = Math.max(0, ...values)
  const lo = Math.min(0, ...values)
  const max = niceCeil(hi) || 1
  const min = lo < 0 ? -niceCeil(-lo) : 0
  return { min, max, ticks: [min, (min + max) / 2, max] }
}

/** The x position of year index i of n. */
export function xAt(i: number, n: number, plot: Plot): number {
  const inner = plot.width - plot.left - plot.right
  return plot.left + (n <= 1 ? inner / 2 : inner * i / (n - 1))
}

/** The y position of a value. */
export function yAt(v: number, scale: Scale, plot: Plot): number {
  const inner = plot.height - plot.top - plot.bottom
  return plot.top + inner * (1 - (v - scale.min) / (scale.max - scale.min || 1))
}

/** The nearest year index to a horizontal position. */
export function indexAt(x: number, n: number, plot: Plot): number {
  if (n <= 1) return 0
  const inner = plot.width - plot.left - plot.right
  const i = Math.round((x - plot.left) / inner * (n - 1))
  return Math.max(0, Math.min(n - 1, i))
}

/** An SVG path through the values; a gap (null) breaks the line. */
export function linePath(data: (number | null)[], scale: Scale, plot: Plot): string {
  let d = '', pen = false
  data.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) { pen = false; return }
    d += `${pen ? 'L' : 'M'}${xAt(i, data.length, plot).toFixed(1)} ${yAt(v, scale, plot).toFixed(1)} `
    pen = true
  })
  return d.trim()
}

/** The same line closed down to zero, for a shaded area (the first unbroken run only). */
export function areaPath(data: (number | null)[], scale: Scale, plot: Plot): string {
  const end = data.findIndex(v => v === null)
  const run = (end < 0 ? data : data.slice(0, end)) as number[]
  if (run.length < 2) return ''
  const n = data.length
  const base = yAt(Math.max(scale.min, 0), scale, plot).toFixed(1)
  return `${linePath(run.concat(Array(n - run.length).fill(null)), scale, plot)} L${xAt(run.length - 1, n, plot).toFixed(1)} ${base} L${xAt(0, n, plot).toFixed(1)} ${base} Z`
}

/** Year labels to print under the axis: the first, the middle and the last. */
export function axisLabels(labels: string[]): { i: number; label: string }[] {
  const idx = [...new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1])].filter(i => i >= 0)
  return idx.map(i => ({ i, label: labels[i] }))
}

/** A short axis label: $0, $250k, $1.5M, $50M (no trailing zeros). */
export function tickLabel(v: number): string {
  const a = Math.abs(v), sign = v < 0 ? '−' : ''
  const trim = (x: number) => String(Number(x.toFixed(1)))
  if (a >= 1_000_000) return `${sign}$${trim(a / 1_000_000)}M`
  if (a >= 1_000) return `${sign}$${trim(a / 1_000)}k`
  return `${sign}$${Math.round(a)}`
}
