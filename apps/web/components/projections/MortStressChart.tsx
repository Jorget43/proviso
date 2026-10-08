'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { crosshair, SCRUB_BASE } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart from '@/components/ui/ScrubChart'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale)

interface MortStressChartProps {
  labels:         string[]
  stressData:     number[]
}

export default function MortStressChart({ labels, stressData }: MortStressChartProps) {
  const c = useChartColors()
  const barColors  = stressData.map(v => v > 35 ? c.a(c.red, 0.75) : v > 30 ? c.a(c.amber, 0.75) : c.a(c.green, 0.65))
  const peakStress = Math.max(...stressData)
  const datasets = [
    { type: 'bar' as const,  label: 'Share of income on housing', data: stressData, backgroundColor: barColors, borderRadius: 3 },
    { type: 'line' as const, label: '30% line', data: Array(labels.length).fill(30), borderColor: c.a(c.red, 0.5), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false, readout: false },
  ]

  return (
    <>
      <ScrubChart labels={labels} datasets={datasets} height={210} format={v => v.toFixed(1) + '%'} defaultIndex={0}>
        <Chart type="bar" plugins={[crosshair]} data={{ labels, datasets }} options={{
          ...SCRUB_BASE,
          scales: {
            x: { ticks: axisTicks(c), grid: { display: false } },
            y: { min: 0, max: Math.max(40, Math.ceil(peakStress / 5) * 5 + 5), ticks: { ...axisTicks(c), callback: v => v + '%' }, grid: { color: c.grid } },
          },
        }} />
      </ScrubChart>
      <p className="proj-note" style={{ marginTop: '0.5rem' }}>
        Home loan repayments as a share of your combined income before tax. Above 30% (the dashed line) is the
        usual Australian definition of &ldquo;mortgage stress&rdquo;.
      </p>
    </>
  )
}
