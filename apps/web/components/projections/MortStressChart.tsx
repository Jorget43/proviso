'use client'
import { Chart as ChartJS, BarElement, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { crosshair, SCRUB_BASE, AXIS_TICKS } from '@/lib/chartPlugins'
import ScrubChart from '@/components/ui/ScrubChart'
ChartJS.register(BarElement, LineElement, PointElement, LinearScale, CategoryScale)

interface MortStressChartProps {
  labels:         string[]
  stressData:     number[]
}

export default function MortStressChart({ labels, stressData }: MortStressChartProps) {
  const barColors  = stressData.map(v => v > 35 ? 'rgba(155,37,37,0.75)' : v > 30 ? 'rgba(138,82,8,0.75)' : 'rgba(22,107,69,0.65)')
  const peakStress = Math.max(...stressData)
  const datasets = [
    { type: 'bar' as const,  label: 'Share of income on housing', data: stressData, backgroundColor: barColors, borderRadius: 3 },
    { type: 'line' as const, label: '30% line', data: Array(labels.length).fill(30), borderColor: 'rgba(155,37,37,0.5)', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false, readout: false },
  ]

  return (
    <>
      <ScrubChart labels={labels} datasets={datasets} height={210} format={v => v.toFixed(1) + '%'} defaultIndex={0}>
        <Chart type="bar" plugins={[crosshair]} data={{ labels, datasets }} options={{
          ...SCRUB_BASE,
          scales: {
            x: { ticks: AXIS_TICKS, grid: { display: false } },
            y: { min: 0, max: Math.max(40, Math.ceil(peakStress / 5) * 5 + 5), ticks: { ...AXIS_TICKS, callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.05)' } },
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
