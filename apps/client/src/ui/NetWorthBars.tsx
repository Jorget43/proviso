// Net worth year by year as a row of bars (Future, What if?).

import { View } from 'react-native'
import { fmtK } from '@proviso/core/formatting'
import { T } from './kit'
import { usePalette, space } from './theme'

/** Net worth each year as bars, labelled at the start, middle and end. Negative years go red. */
export function NetWorthBars({ labels, values, height = 96 }: { labels: string[]; values: number[]; height?: number }) {
  const p = usePalette()
  const max = Math.max(1, ...values.map(Math.abs))
  const H = height
  return (
    <View accessible accessibilityLabel={`Net worth from ${fmtK(values[0] ?? 0)} in ${labels[0]} to ${fmtK(values[values.length - 1] ?? 0)} in ${labels[labels.length - 1]}`}
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
