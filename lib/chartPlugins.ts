// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const crosshair: any = {
  id: 'crosshair',
  afterDraw(chart: {
    tooltip?: { getActiveElements(): { element: { x: number } }[] }
    ctx: CanvasRenderingContext2D
    scales: Record<string, { axis: string; top: number; bottom: number }>
  }) {
    const active = chart.tooltip?.getActiveElements()
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
