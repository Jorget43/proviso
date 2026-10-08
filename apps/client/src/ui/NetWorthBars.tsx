// A row of bars over time (net worth by year on Future and What if?; cash by month on Next 2 years).

import { View } from 'react-native'
import { fmtK } from '@proviso/core/formatting'
import { T } from './kit'
import { usePalette, space } from './theme'

/** Values as bars, labelled at the start, middle and end. Negative ones go red. */
export function NetWorthBars({ labels, values, height = 96, what = 'Net worth' }: { labels: string[]; values: number[]; height?: number; what?: string }) {
  const p = usePalette()
  const max = Math.max(1, ...values.map(Math.abs))
  const H = height
  return (
    <View accessible accessibilityLabel={`${what} from ${fmtK(values[0] ?? 0)} in ${labels[0]} to ${fmtK(values[values.length - 1] ?? 0)} in ${labels[labels.length - 1]}`}
      style={{ marginTop: space.md, gap: space.xs }}>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {values.map((v, i) => (
          <View key={labels[i]} style={{ flex: 1, height: Math.max(2, Math.abs(v) / max * H), borderRadius: 2, backgroundColor: v >= 0 ? p.green : p.red, opacity: 0.85 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[...new Set([labels[0], labels[Math.floor((labels.length - 1) / 2)], labels[labels.length - 1]])].map(l => (
          <T key={l} size="caption" tone="t3">{l}</T>
        ))}
      </View>
    </View>
  )
}
