'use client'
// Home: what's left on the home loan each year, with the repayments as a
// share of household income in the readout. Years above 30% (the usual
// "mortgage stress" line) are marked. (Replaces the separate Home loan and
// Housing costs charts.)
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { crosshair, SCRUB_BASE, kTicks } from '@/lib/chartPlugins'
import { useChartColors, axisTicks } from '@/lib/chartTheme'
import ScrubChart from '@/components/ui/ScrubChart'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler)

interface Props {
  labels:     string[]
  mortData:   number[]
  stressData: number[]   // repayments as % of gross household income
  rentData:   number[]   // rent paid each year (0 when not renting)
  endDate:    string
}

export default function HomeChart({ labels, mortData, stressData, rentData, endDate }: Props) {
  const c = useChartColors()
  const pct = (v: number) => `${v.toFixed(0)}% of income`
  // On their own hidden scale, so they don't stretch the chart.
  const readOnly = { borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, showLine: false, fill: false, yAxisID: 'readout' }
  const datasets = [
    { label: 'Home loan left', data: mortData, borderColor: c.red, backgroundColor: c.a(c.red, 0.07), fill: true, tension: 0.4, borderWidth: 2,
      pointRadius: stressData.map(s => (s > 30 ? 3.5 : 0)), pointBackgroundColor: c.amber, pointBorderColor: c.amber, pointHoverRadius: 4 },
    { ...readOnly, label: 'Repayments', data: stressData, borderColor: c.amber, format: pct },
    { ...readOnly, label: 'Rent paid', data: rentData, borderColor: c.blue },
  ]
  return (
    <>
      <ScrubChart labels={labels} datasets={datasets} height={240}>
        <Line data={{ labels, datasets: datasets as never[] }} plugins={[crosshair]} options={{
          ...SCRUB_BASE,
          scales: {
            x: { ticks: axisTicks(c), grid: { display: false } },
            y: { min: 0, ticks: { ...axisTicks(c), callback: kTicks }, grid: { color: c.grid } },
            readout: { display: false },
          },
        }} />
      </ScrubChart>
      <p className="proj-note mt1">
        Amber dots: years when repayments take more than 30% of household income before tax.{endDate ? ` Your loan is set to end ${endDate}.` : ''}
      </p>
    </>
  )
}
