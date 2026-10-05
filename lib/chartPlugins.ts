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
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.setLineDash([4, 4])
    ctx.stroke()
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

export const AXIS_TICKS = { font: { size: 10 }, color: '#A09484' } as const
export const kTicks = (v: number | string) => {
  const n = Number(v)
  const sign = n < 0 ? '-$' : '$'
  if (Math.abs(n) >= 1e6) return sign + +(Math.abs(n) / 1e6).toFixed(1) + 'M'
  return sign + Math.round(Math.abs(n) / 1000) + 'k'
}
