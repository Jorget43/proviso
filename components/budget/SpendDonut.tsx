'use client'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { CATS, CAT_COLORS } from '@/lib/constants'
import { fmt } from '@/lib/formatting'
import Panel from '@/components/ui/Panel'

ChartJS.register(ArcElement, Tooltip)

interface SpendDonutProps {
  catMonthly: Record<string, number>
}

export default function SpendDonut({ catMonthly }: SpendDonutProps) {
  const labels = CATS.filter(c => (catMonthly[c] ?? 0) > 0)
  const data   = labels.map(c => catMonthly[c] ?? 0)
  const colors = labels.map(c => CAT_COLORS[CATS.indexOf(c)])

  const chartData = {
    labels,
    datasets: [{
      data,
      backgroundColor: colors,
      borderColor: '#FFFFFF',
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
