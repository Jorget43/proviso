'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { crosshair } from '@/lib/chartPlugins'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

interface MortStressChartProps {
  labels:         string[]
  stressData:     number[]
}

export default function MortStressChart({ labels, stressData }: MortStressChartProps) {
  const barColors   = stressData.map(v => v > 35 ? 'rgba(155,37,37,0.75)' : v > 30 ? 'rgba(138,82,8,0.75)' : 'rgba(22,107,69,0.65)')
  const stressYrs   = labels.filter((_, i) => stressData[i] > 30)
  const peakStress  = Math.max(...stressData)
  const peakIdx     = stressData.indexOf(peakStress)
  const peakYr      = peakIdx >= 0 ? labels[peakIdx] : '—'
  const cur         = stressData[0] ?? 0
  const curColor    = cur > 35 ? 'var(--red)' : cur > 30 ? 'var(--amber)' : 'var(--green)'

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {[
          { label: 'Current ratio',     val: cur.toFixed(1) + '%',                    color: curColor },
          { label: 'Peak stress',       val: peakStress.toFixed(1) + '% (' + peakYr + ')', color: 'var(--red)' },
          { label: 'Stress years (>30%)', val: stressYrs.length > 0 ? stressYrs.join(', ') : 'None', color: stressYrs.length > 0 ? 'var(--amber)' : 'var(--green)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '0.55rem 0.75rem' }}>
            <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color }}>{val}</div>
          </div>
        ))}
      </div>
      <div className="chart-wrap" style={{ height: 200 }}>
        <Chart type="bar" plugins={[crosshair]} data={{
          labels,
          datasets: [
            { type: 'bar' as const,  label: 'Housing cost ratio', data: stressData, backgroundColor: barColors, borderRadius: 3 },
            { type: 'line' as const, label: '30% threshold', data: Array(labels.length).fill(30), borderColor: 'rgba(155,37,37,0.5)', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false },
          ],
        }} options={{
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index' as const, intersect: false },
          plugins: {
            legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: '#6A5F4A', boxWidth: 8, boxHeight: 8 } },
            tooltip: { callbacks: { label: ctx => ctx.dataset.label === '30% threshold' ? '' : ` ${ctx.dataset.label}: ${(ctx.parsed.y as number).toFixed(1)}%` } },
          },
          scales: {
            x: { ticks: { font: { size: 10 }, color: '#A09484' }, grid: { display: false } },
            y: { min: 0, max: Math.max(40, Math.ceil(peakStress / 5) * 5 + 5), ticks: { callback: v => v + '%', font: { size: 10 }, color: '#A09484' }, grid: { color: 'rgba(0,0,0,0.05)' } },
          },
        }} />
      </div>
      <p className="proj-note" style={{ marginTop: '0.5rem' }}>Mortgage stress = housing repayments &gt;30% of gross household income (standard Australian definition). Dashed = 30% threshold.</p>
    </>
  )
}
