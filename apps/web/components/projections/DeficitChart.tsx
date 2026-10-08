'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { fmtK, fmtS } from '@proviso/core/formatting'
import { crosshair, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart from '@/components/ui/ScrubChart'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale, Filler)

interface DeficitChartProps {
  labels:           string[]
  deficitData:      number[]
  cashRunningData:  number[]
}

export default function DeficitChart({ labels, deficitData, cashRunningData }: DeficitChartProps) {
  const c = useChartColors()
  const barColors   = deficitData.map(v => v < 0 ? c.a(c.red, 0.8) : c.a(c.green, 0.65))
  const totalDef    = deficitData.filter(v => v < 0).reduce((s, v) => s + v, 0)
  const totalSur    = deficitData.filter(v => v > 0).reduce((s, v) => s + v, 0)
  const net         = totalDef + totalSur
  const worstIdx    = deficitData.indexOf(Math.min(...deficitData))

  const balance = [{ type: 'bar' as const, label: 'Left over that year', data: deficitData, backgroundColor: barColors, borderRadius: 3 }]
  const cash = [{
    type: 'line' as const, label: 'Cash in the bank', data: cashRunningData,
    borderColor: c.a(c.blue, 0.75), backgroundColor: c.a(c.blue, 0.08),
    borderDash: [3, 3], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, fill: true,
  }]

  return (
    <>
      <ScrubChart labels={labels} datasets={balance} height={220} format={fmtS}
        defaultIndex={totalDef < 0 && worstIdx >= 0 ? worstIdx : undefined}>
        <Chart type="bar" plugins={[crosshair]} data={{ labels, datasets: balance }} options={{
          ...SCRUB_BASE,
          scales: {
            x: { ticks: axisTicks(c), grid: { display: false } },
            y: { ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
          },
        }} />
      </ScrubChart>

      <div className="mini-stats">
        {[
          { label: 'Short years total', val: fmtK(totalDef), color: 'var(--red)' },
          { label: 'Good years total',  val: fmtK(totalSur), color: 'var(--green)' },
          { label: 'Overall',           val: fmtK(net),      color: net >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map(({ label, val, color }) => (
          <div key={label} className="mini-stat">
            <span>{label}</span>
            <strong style={{ color }}>{val}</strong>
          </div>
        ))}
      </div>

      <h3 className="explorer-sub">Cash in the bank</h3>
      <ScrubChart labels={labels} datasets={cash} height={150}>
        <Chart type="line" plugins={[crosshair]} data={{ labels, datasets: cash }} options={{
          ...SCRUB_BASE,
          scales: {
            x: { ticks: axisTicks(c), grid: { display: false } },
            y: { min: 0, ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
          },
        }} />
      </ScrubChart>
    </>
  )
}
