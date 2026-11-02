// Which years Future's charts show: quick choices, and a stepper to move the
// window along (the app has no slider; steppers give exact values without a
// native module). Every ScrubChart inside a YearWindow follows it. The NAS
// has the same control (apps/web/components/ui/YearRange.tsx).

import { View } from 'react-native'
import { Choice, Stepper, T } from './kit'
import { space } from './theme'

export interface YearSpan { from: number; to: number }

export function YearRange({ first, last, value, presets, onChange }: {
  first: number; last: number; value: YearSpan | null
  presets: { key: string; label: string; span: YearSpan | null }[]
  onChange: (span: YearSpan | null) => void
}) {
  const picked = presets.find(x => (x.span ? value && x.span.from === value.from && x.span.to === value.to : !value))
  const span = value ? value.to - value.from : 0
  return (
    <View style={{ gap: space.xs }}>
      <Choice wrap label="Years shown" options={presets.map(x => ({ key: x.key, label: x.label }))}
        value={picked?.key ?? ''} onChange={k => onChange(presets.find(x => x.key === k)?.span ?? null)} />
      {value && (
        <Stepper label="Starting in" min={first} max={last - span} step={1} value={value.from}
          onChange={v => onChange({ from: v, to: v + span })} format={v => `${v}–${v + span}`} />
      )}
      {!value && <T size="caption" tone="t3">{first}–{last}</T>}
    </View>
  )
}
