// Scenarios drawn over a Future chart (@proviso/core/scenarios): each one a
// dashed line in its colour, with the difference from the plan in the
// scrub readout. A scenario can look further ahead than the plan; it's cut
// to the plan's years so every line shares the axis.

import type { ScenarioColour } from '@proviso/core/scenarios'
import type { ScrubSeries } from '@/components/ui/ScrubChart'
import type { ChartColors } from './chartTheme'

export interface Overlay {
  label:  string
  colour: ScenarioColour
  /** One value per year, from the plan's first year. */
  data:   number[]
  /** Extra values listed in the readout only (not drawn), e.g. what's left over. */
  readouts?: { label: string; data: number[]; compareTo: number[]; format?: (v: number) => string }[]
}

/** `data` fitted to `length` years, with `pad` empty years in front (history shown before the projection). */
export function fit(data: number[], length: number, pad = 0): (number | null)[] {
  const out: (number | null)[] = data.slice(0, length)
  while (out.length < length) out.push(null)
  return [...Array(pad).fill(null), ...out]
}

/**
 * Chart.js datasets for the overlays. `compareTo` is the plan's series for
 * the same thing (already padded); `chartType` 'line' is needed on bar charts.
 */
export function overlayDatasets(
  overlays: Overlay[] | undefined, c: ChartColors, length: number, compareTo: (number | null)[], pad = 0, chartType?: 'line',
): (ScrubSeries & Record<string, unknown>)[] {
  return (overlays ?? []).flatMap((o, k) => [
    {
      ...(chartType ? { type: chartType } : {}),
      // Its own stack: on a stacked bar chart a line would otherwise sit on top of the bars.
      stack: `scenario-${k}`,
      label: o.label, data: fit(o.data, length, pad), compareTo,
      borderColor: c[o.colour], backgroundColor: c[o.colour],
      borderDash: [7, 4], borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, fill: false, tension: 0.4, order: -1,
    },
    ...(o.readouts ?? []).map(r => ({
      type: 'line' as const, label: r.label, data: fit(r.data, length, pad), compareTo: fit(r.compareTo, length, pad), format: r.format,
      borderColor: c[o.colour], borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, showLine: false, fill: false, yAxisID: 'readout',
    })),
  ])
}
