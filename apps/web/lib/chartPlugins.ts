// Draws a dashed vertical line through the active point. The active point is
// set by ScrubChart (charts there run with Chart.js's own events and tooltip
// turned off); the tooltip fallback covers charts that still use Chart.js hover.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const crosshair: any = {
  id: 'crosshair',
  afterDraw(chart: {
    getActiveElements?(): { element: { x: number } }[]
    tooltip?: { getActiveElements(): { element: { x: number } }[] }
    ctx: CanvasRenderingContext2D
    scales: Record<string, { axis: string; top: number; bottom: number }>
  }) {
    const own = chart.getActiveElements?.()
    const active = own?.length ? own : chart.tooltip?.getActiveElements()
    if (!active?.length) return
    const ctx = chart.ctx
    const x = active[0].element.x
    const scale = chart.scales['y'] ?? Object.values(chart.scales).find(s => s.axis === 'y')
    if (!scale) return
    const { top, bottom } = scale
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = getComputedStyle(chart.ctx.canvas).getPropertyValue('--t3').trim() || 'rgba(0,0,0,0.18)'
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.restore()
  },
}

// Names drawn at the right-hand end of lines that carry an `endLabel`, so a
// line can be told apart without matching colours against the readout. The
// chart makes room for them on the right; names that would overlap are
// nudged apart.
const END_FONT = '11px system-ui, -apple-system, "Segoe UI", sans-serif'
const END_GAP = 13
const shortName = (s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s)

interface EndLabelChart {
  ctx: CanvasRenderingContext2D
  width: number
  chartArea: { top: number; bottom: number; right: number }
  options: { layout?: { padding?: unknown } }
  data: { datasets: { endLabel?: string; data: unknown[]; borderColor?: unknown }[] }
  scales: Record<string, { min: number; max: number }>
  isDatasetVisible(k: number): boolean
  getDatasetMeta(k: number): { data: { x: number; y: number }[] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const endLabels: any = {
  id: 'endLabels',
  beforeLayout(chart: EndLabelChart) {
    const { ctx } = chart
    ctx.save()
    ctx.font = END_FONT
    let w = 0
    chart.data.datasets.forEach((d, k) => {
      if (d.endLabel && chart.isDatasetVisible(k)) w = Math.max(w, ctx.measureText(shortName(d.endLabel)).width)
    })
    ctx.restore()
    const right = w ? Math.min(Math.ceil(w) + 10, chart.width * 0.3) : 0
    chart.options.layout = { ...(chart.options.layout ?? {}), padding: { top: 4, right, bottom: 0, left: 0 } }
  },
  afterDatasetsDraw(chart: EndLabelChart) {
    const x = chart.scales.x
    if (!x) return
    const items: { y: number; text: string; color: string }[] = []
    chart.data.datasets.forEach((d, k) => {
      if (!d.endLabel || !chart.isDatasetVisible(k)) return
      const points = chart.getDatasetMeta(k).data
      for (let i = Math.min(x.max, d.data.length - 1); i >= x.min; i--) {
        if (d.data[i] != null && points[i]) {
          items.push({ y: points[i].y, text: shortName(d.endLabel), color: typeof d.borderColor === 'string' ? d.borderColor : '#888' })
          break
        }
      }
    })
    if (!items.length) return
    const { top, bottom, right } = chart.chartArea
    items.sort((a, b) => a.y - b.y)
    items.forEach((it, i) => { it.y = Math.max(it.y, top + 6, i ? items[i - 1].y + END_GAP : -Infinity) })
    // If the last ones were pushed off the bottom, pull the stack back up.
    for (let i = items.length - 1; i >= 0; i--) {
      const limit = i === items.length - 1 ? bottom - 4 : items[i + 1].y - END_GAP
      if (items[i].y > limit) items[i].y = limit
    }
    const { ctx } = chart
    ctx.save()
    ctx.font = END_FONT
    ctx.textBaseline = 'middle'
    for (const it of items) {
      ctx.fillStyle = it.color
      ctx.fillText(it.text, right + 6, it.y)
    }
    ctx.restore()
  },
}

// Base options for charts wrapped in ScrubChart: Chart.js's own hover,
// tooltip and legend are off — ScrubChart's readout replaces all three.
export const SCRUB_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  events: [] as (keyof HTMLElementEventMap)[],
  plugins: {
    legend:  { display: false },
    tooltip: { enabled: false },
  },
} as const

export const kTicks = (v: number | string) => {
  const n = Number(v)
  const sign = n < 0 ? '-$' : '$'
  if (Math.abs(n) >= 1e6) return sign + +(Math.abs(n) / 1e6).toFixed(1) + 'M'
  return sign + Math.round(Math.abs(n) / 1000) + 'k'
}
