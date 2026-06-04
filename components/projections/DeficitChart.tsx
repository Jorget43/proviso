'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { fmtK, fmtS } from '@/lib/formatting'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

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

  return (
    <>
      <div className="chart-wrap" style={{ height: 220 }}>
        <Chart type="bar" data={{
          labels,
          datasets: [
            { type: 'bar' as const,  label: 'Annual surplus/deficit', data: deficitData, backgroundColor: barColors, borderRadius: 3, order: 2 },
            { type: 'line' as const, label: 'Cash balance', data: cashRunningData, borderColor: 'rgba(30,95,168,0.7)', borderDash: [3, 3], borderWidth: 1.5, pointRadius: 2, fill: false, yAxisID: 'y2', order: 1 },
          ],
        }} options={{
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: '#6A5F4A', boxWidth: 8, boxHeight: 8 } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: $${(ctx.parsed.y as number).toLocaleString('en-AU')}${(ctx.parsed.y as number) < 0 ? ' ⚠' : ''}` } },
          },
          scales: {
            x:  { ticks: { font: { size: 10 }, color: '#A09484' }, grid: { display: false } },
            y:  { ticks: { callback: v => '$' + Math.round(Number(v) / 1000) + 'k', font: { size: 10 }, color: '#A09484' }, grid: { color: 'rgba(0,0,0,0.05)' }, title: { display: true, text: 'Surplus/deficit', font: { size: 9 }, color: '#A09484' } },
            y2: { position: 'right', ticks: { callback: v => '$' + Math.round(Number(v) / 1000) + 'k', font: { size: 10 }, color: 'rgba(30,95,168,0.7)' }, grid: { display: false } },
          },
        }} />
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        {deficitYrs.length > 0 ? (
          <>
            <p style={{ fontSize: '0.74rem', color: 'var(--red)', marginBottom: '0.5rem' }}>
              <strong>Deficit years: {deficitYrs.join(', ')}</strong><br />
              Worst: {worstYr} ({fmtS(worstVal)}/yr). Total shortfall: {fmtK(totalDef)}.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
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
          </>
        ) : (
          <p style={{ fontSize: '0.76rem', color: 'var(--green)', fontWeight: 500 }}>✓ No deficit years in this projection period.</p>
        )}
      </div>
    </>
  )
}
