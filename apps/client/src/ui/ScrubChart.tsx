// A line chart you scrub: drag sideways across it (or move the mouse on the
// web) to go through the years, and the readout above shows that year's
// values. The readout doubles as the legend: tap an item to hide that line.
// Up-and-down drags still scroll the page. Same behaviour as the NAS charts
// (apps/web/components/ui/ScrubChart.tsx); the maths is in chartGeometry.ts.

import { useMemo, useRef, useState } from 'react'
import { Platform, Pressable, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg'
import { fmtK } from '@proviso/core/formatting'
import { T } from './kit'
import { usePalette, space, radius } from './theme'
import { areaPath, axisLabels, bandPath, indexAt, linePath, scaleFor, tickLabel, xAt, yAt, type Plot } from './chartGeometry'

export interface ChartSeries {
  key:    string
  label:  string
  data:   (number | null)[]
  color:  string
  /** Scenarios and secondary lines are dashed. */
  dashed?: boolean
  /** Shade under the line (the main series). */
  area?:   boolean
  /** The plan's values: the readout adds the difference from them. */
  compareTo?: (number | null)[]
  /** How the value reads (default $12k). */
  format?: (v: number) => string
  /** A shaded range around the line (weaker and stronger returns); the readout gives both ends. */
  band?:   { low: (number | null)[]; high: (number | null)[] }
}

interface Props {
  labels:        string[]
  series:        ChartSeries[]
  height?:       number
  /** The year shown before anyone touches the chart; the last by default. */
  defaultIndex?: number
  /** What the chart shows, for screen readers ("Net worth"). */
  title:         string
  /** Leaves out the "drag across" hint, where space is tight (What if?'s header). */
  compact?:      boolean
}

const MARGIN = { left: 44, right: 8, top: 8, bottom: 20 }
// SVG text on the web falls back to a serif font; use the same system font as the app's text.
const AXIS_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined

export function ScrubChart({ labels, series, height = 180, defaultIndex, title, compact }: Props) {
  const p = usePalette()
  const [width, setWidth] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const n = labels.length
  const idx = Math.max(0, Math.min(n - 1, picked ?? defaultIndex ?? n - 1))

  const plot: Plot = { width, height, ...MARGIN }
  const shown = series.filter(s => !hidden.has(s.key))
  const scale = useMemo(() => scaleFor((shown.length ? shown : series).flatMap(s => [s.data, ...(s.band ? [s.band.low, s.band.high] : [])])), [shown, series])

  // Where a touch started, to tell a sideways scrub from an up-and-down scroll.
  const start = useRef({ x: 0, y: 0 })
  const pick = (x: number) => setPicked(indexAt(x, n, plot))
  const sideways = (e: GestureResponderEvent) =>
    Math.abs(e.nativeEvent.pageX - start.current.x) >= Math.abs(e.nativeEvent.pageY - start.current.y)
  const touch = {
    onStartShouldSetResponder: (e: GestureResponderEvent) => { start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }; return true },
    onMoveShouldSetResponder: sideways,
    onResponderGrant: (e: GestureResponderEvent) => pick(e.nativeEvent.locationX),
    onResponderMove: (e: GestureResponderEvent) => pick(e.nativeEvent.locationX),
    // Let the page scroll when the drag is mostly up or down.
    onResponderTerminationRequest: (e: GestureResponderEvent) => !sideways(e),
  }

  const toggle = (key: string) => setHidden(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const fmt = (s: ChartSeries, v: number) => (s.format ?? fmtK)(v)
  // Series with nothing to say (all empty) stay out of the readout.
  const items = series.filter(s => s.data.some(v => v !== null && v !== 0))
  const hover = Platform.OS === 'web'
    ? { onPointerMove: (e: { nativeEvent: unknown }) => {
        const ne = e.nativeEvent as { pointerType?: string; offsetX?: number; locationX?: number }
        if (ne.pointerType === 'mouse') setPicked(indexAt(ne.offsetX ?? ne.locationX ?? 0, n, plot))
      } }
    : {}

  return (
    // Measured here: the chart takes the full width.
    <View style={{ gap: space.sm }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ gap: space.xs }} accessibilityLiveRegion="polite">
        <T weight="700">{labels[idx]}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {items.map(s => {
            const v = s.data[idx]
            const base = s.compareTo?.[idx]
            const diff = v != null && base != null ? v - base : null
            const off = hidden.has(s.key)
            return (
              <Pressable key={s.key} onPress={() => toggle(s.key)} accessibilityRole="button" accessibilityState={{ selected: !off }}
                accessibilityHint={off ? `Shows ${s.label}` : `Hides ${s.label}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 32, paddingHorizontal: space.sm, paddingVertical: 4,
                  borderRadius: radius.pill, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, opacity: off ? 0.45 : 1 }}>
                <View style={{ width: 14, borderTopWidth: 2.5, borderStyle: s.dashed ? 'dashed' : 'solid', borderColor: s.color }} />
                <T size="small" tone="t2" style={{ textDecorationLine: off ? 'line-through' : 'none' }}>{s.label}</T>
                <T size="small" weight="600">{v == null ? '—' : fmt(s, v)}</T>
                {s.band && s.band.low[idx] != null && s.band.high[idx] != null && (
                  <T size="caption" tone="t3">{`${fmt(s, s.band.low[idx]!)} to ${fmt(s, s.band.high[idx]!)}`}</T>
                )}
                {diff !== null && (
                  <T size="caption" tone="t3">{Math.abs(diff) < 1 ? 'same as plan' : `${diff > 0 ? '+' : '−'}${fmt(s, Math.abs(diff)).replace(/^[+−-]/, '')} vs plan`}</T>
                )}
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={{ height }}
        accessible accessibilityRole="adjustable" accessibilityLabel={title}
        accessibilityValue={{ text: `${labels[idx]}: ${shown.map(s => `${s.label} ${s.data[idx] == null ? 'none' : fmt(s, s.data[idx]!)}`).join(', ')}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => setPicked(Math.max(0, Math.min(n - 1, idx + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {scale.ticks.map(t => (
              <Line key={`g${t}`} x1={MARGIN.left} x2={width - MARGIN.right} y1={yAt(t, scale, plot)} y2={yAt(t, scale, plot)} stroke={p.border} strokeWidth={1} />
            ))}
            {scale.ticks.map(t => (
              <SvgText key={`t${t}`} x={MARGIN.left - 6} y={yAt(t, scale, plot) + 4} fontSize={10} fontFamily={AXIS_FONT} fill={p.t3} textAnchor="end">{tickLabel(t)}</SvgText>
            ))}
            {axisLabels(labels).map(({ i, label }) => (
              <SvgText key={`x${i}`} x={xAt(i, n, plot)} y={height - 4} fontSize={10} fontFamily={AXIS_FONT} fill={p.t3}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{label}</SvgText>
            ))}
            {shown.filter(s => s.band).map(s => (
              <Path key={`b${s.key}`} d={bandPath(s.band!.low, s.band!.high, scale, plot)} fill={s.color} fillOpacity={0.14} />
            ))}
            {shown.filter(s => s.area && !s.band).map(s => (
              <Path key={`a${s.key}`} d={areaPath(s.data, scale, plot)} fill={s.color} fillOpacity={0.08} />
            ))}
            {shown.map(s => (
              <Path key={s.key} d={linePath(s.data, scale, plot)} stroke={s.color} strokeWidth={s.dashed ? 2 : 2.5} fill="none"
                strokeDasharray={s.dashed ? '6 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            <Line x1={xAt(idx, n, plot)} x2={xAt(idx, n, plot)} y1={MARGIN.top} y2={height - MARGIN.bottom} stroke={p.t3} strokeWidth={1} strokeDasharray="3 3" />
            {shown.map(s => s.data[idx] == null ? null : (
              <Circle key={`c${s.key}`} cx={xAt(idx, n, plot)} cy={yAt(s.data[idx]!, scale, plot)} r={4} fill={s.color} stroke={p.surface} strokeWidth={1.5} />
            ))}
          </Svg>
        )}
        {/* Catches touches over the whole chart, so positions are measured from its left edge. */}
        <View {...touch} {...hover} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      </View>
      {!compact && <T size="caption" tone="t3">{Platform.OS === 'web' ? 'Move across the chart to see each year · tap a label to hide it' : 'Drag across the chart · tap a label to hide it'}</T>}
    </View>
  )
}
