'use client'
import { Chart as ChartJS, ArcElement, Tooltip, type Plugin } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { CATS, CAT_COLORS } from '@proviso/core/constants'
import { fmt } from '@proviso/core/formatting'
import Panel from '@/components/ui/Panel'
import { useChartColors } from '@/lib/chartTheme'

// Draw the percentage on each slice that's big enough to read, plus a centred
// total — so the donut is labelled by default without needing a hover/tap.
const arcLabels: Plugin<'doughnut'> = {
  id: 'arcLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const meta = chart.getDatasetMeta(0)
    const values = chart.data.datasets[0].data as number[]
    const total = values.reduce((s, v) => s + (v || 0), 0)
    if (total <= 0) return

    meta.data.forEach((arc, i) => {
      const pct = (values[i] / total) * 100
      if (pct < 8) return // too thin to label legibly
      const { startAngle, endAngle, innerRadius, outerRadius, x, y } =
        arc.getProps(['startAngle', 'endAngle', 'innerRadius', 'outerRadius', 'x', 'y'], true)
      const mid = (startAngle + endAngle) / 2
      const r = (innerRadius + outerRadius) / 2
      ctx.save()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '600 9px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${pct.toFixed(0)}%`, x + Math.cos(mid) * r, y + Math.sin(mid) * r)
      ctx.restore()
    })

    // Centre total, in the theme's text colours (read when drawn, so a theme switch applies).
    const css = getComputedStyle(chart.canvas)
    const cx = meta.data[0] ? (meta.data[0].getProps(['x'], true) as { x: number }).x : chart.width / 2
    const cy = meta.data[0] ? (meta.data[0].getProps(['y'], true) as { y: number }).y : chart.height / 2
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = css.getPropertyValue('--t2').trim()
    ctx.font = '500 9px system-ui, sans-serif'
    ctx.fillText('per month', cx, cy + 9)
    ctx.fillStyle = css.getPropertyValue('--t1').trim()
    ctx.font = '600 14px system-ui, sans-serif'
    ctx.fillText(fmt(total), cx, cy - 4)
    ctx.restore()
  },
}

ChartJS.register(ArcElement, Tooltip)

interface SpendDonutProps {
  catMonthly: Record<string, number>
}

export default function SpendDonut({ catMonthly }: SpendDonutProps) {
  const c = useChartColors()
  const labels = CATS.filter(c => (catMonthly[c] ?? 0) > 0)
  const data   = labels.map(c => catMonthly[c] ?? 0)
  const colors = labels.map(c => CAT_COLORS[CATS.indexOf(c)])

  const chartData = {
    labels,
    datasets: [{
      data,
      backgroundColor: colors,
      borderColor: c.surface,
      borderWidth: 2,
      hoverOffset: 6,
    }],
  }

  const total = data.reduce((s, v) => s + v, 0)

  return (
    <Panel title="Spend by category" dotColor="var(--blue)">
      <div style={{ height: 160, position: 'relative' }}>
        <Doughnut
          data={chartData}
          plugins={[arcLabels]}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => ` ${ctx.label}: ${fmt(ctx.raw as number)} (${total > 0 ? (ctx.raw as number / total * 100).toFixed(1) : 0}%)`,
                },
              },
            },
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: '0.75rem' }}>
        {labels.map((label, i) => {
          const pct = total > 0 ? (data[i] / total * 100).toFixed(1) : '0'
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem' }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: colors[i], flexShrink: 0, display: 'inline-block',
              }} />
              <span style={{ flex: 1, color: 'var(--t2)' }}>{label}</span>
              <span style={{ color: 'var(--t3)', fontSize: '0.66rem' }}>{pct}%</span>
              <span style={{ fontWeight: 500, minWidth: 58, textAlign: 'right' }}>{fmt(data[i])}</span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
