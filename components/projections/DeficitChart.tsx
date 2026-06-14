'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, type Plugin } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { fmtK, fmtS } from '@/lib/formatting'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

const crosshair: Plugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const active = chart.tooltip?.getActiveElements()
    if (!active?.length) return
    const ctx = chart.ctx
    const x = active[0].element.x
    const { top, bottom } = chart.scales['y'] ?? chart.scales['y2'] ?? Object.values(chart.scales)[0]
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

interface DeficitChartProps {
  labels:           string[]
  deficitData:      number[]
  cashRunningData:  number[]
}

export default function DeficitChart({ labels, deficitData, cashRunningData }: DeficitChartProps) {
  const barColors   = deficitData.map(v => v < 0 ? 'rgba(155,37,37,0.8)' : 'rgba(22,107,69,0.65)')
  const deficitYrs  = labels.filter((_, i) => deficitData[i] < 0)
  const worstIdx    = deficitData.indexOf(Math.min(...deficitData))
  const worstYr     = worstIdx >= 0 ? labels[worstIdx] : null
  const worstVal    = worstIdx >= 0 ? deficitData[worstIdx] : 0
  const totalDef    = deficitData.filter(v => v < 0).reduce((s, v) => s + v, 0)
  const totalSur    = deficitData.filter(v => v > 0).reduce((s, v) => s + v, 0)
  const net         = totalDef + totalSur

  const sharedXOptions = {
    ticks: { font: { size: 10 }, color: '#A09484' },
    grid: { display: false },
  } as const

  const sharedTooltipLabel = (ctx: { dataset: { label?: string }, parsed: { y: number | null } }) => {
    const y = ctx.parsed.y ?? 0
    return ` ${ctx.dataset.label}: $${Math.round(y).toLocaleString('en-AU')}${y < 0 ? ' ⚠' : ''}`
  }

  return (
    <>
      {/* ── Surplus / deficit bar chart ──────────────────────────────────── */}
      <div className="chart-wrap" style={{ height: 240 }}>
        <Chart
          type="bar"
          plugins={[crosshair]}
          data={{
            labels,
            datasets: [
              { type: 'bar' as const, label: 'Annual surplus/deficit', data: deficitData, backgroundColor: barColors, borderRadius: 3 },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: '#6A5F4A', boxWidth: 8, boxHeight: 8 } },
              tooltip: { callbacks: { label: sharedTooltipLabel } },
            },
            scales: {
              x: sharedXOptions,
              y: {
                ticks: { callback: v => '$' + Math.round(Number(v) / 1000) + 'k', font: { size: 10 }, color: '#A09484' },
                grid: { color: 'rgba(0,0,0,0.05)' },
                title: { display: true, text: 'Surplus / deficit', font: { size: 9 }, color: '#A09484' },
              },
            },
          }}
        />
      </div>

      {/* ── Summary cards ────────────────────────────────────────────────── */}
      <div style={{ marginTop: '0.75rem' }}>
        {deficitYrs.length > 0 ? (
          <p style={{ fontSize: '0.74rem', color: 'var(--red)', marginBottom: '0.75rem' }}>
            <strong>Deficit years: {deficitYrs.join(', ')}</strong><br />
            Worst: {worstYr} ({fmtS(worstVal)}/yr). Total shortfall: {fmtK(totalDef)}.
          </p>
        ) : (
          <p style={{ fontSize: '0.76rem', color: 'var(--green)', fontWeight: 500, marginBottom: '0.75rem' }}>✓ No deficit years in this projection period.</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Total shortfall', val: fmtK(totalDef), color: 'var(--red)' },
            { label: 'Total surplus',   val: fmtK(totalSur), color: 'var(--green)' },
            { label: 'Net over period', val: fmtK(net),      color: net >= 0 ? 'var(--green)' : 'var(--red)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '0.55rem 0.75rem' }}>
              <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cash balance line chart ───────────────────────────────────────── */}
      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t3)', marginBottom: '0.4rem' }}>
        Cash balance trajectory
      </div>
      <div className="chart-wrap" style={{ height: 130 }}>
        <Chart
          type="line"
          plugins={[crosshair]}
          data={{
            labels,
            datasets: [
              {
                label: 'Cash balance',
                data: cashRunningData,
                borderColor: 'rgba(30,95,168,0.75)',
                backgroundColor: 'rgba(30,95,168,0.08)',
                borderDash: [3, 3],
                borderWidth: 1.5,
                pointRadius: 2,
                fill: true,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: sharedTooltipLabel } },
            },
            scales: {
              x: sharedXOptions,
              y: {
                min: 0,
                ticks: { callback: v => '$' + Math.round(Number(v) / 1000) + 'k', font: { size: 10 }, color: 'rgba(30,95,168,0.7)' },
                grid: { color: 'rgba(0,0,0,0.04)' },
              },
            },
          }}
        />
      </div>
    </>
  )
}
