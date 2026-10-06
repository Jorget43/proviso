// Small building blocks shared by every screen, styled only with tokens.

import type { ReactNode } from 'react'
import { Pressable, ScrollView, Text, TextInput, View, type AccessibilityRole, type PressableProps, type TextStyle, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette, space, radius, font, touch } from './theme'

export function Screen({ children }: { children: ReactNode }) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + insets.bottom, gap: space.lg, maxWidth: 720, width: '100%', alignSelf: 'center' }}
    >
      {children}
    </ScrollView>
  )
}

export function Card({ children, style, tone }: { children: ReactNode; style?: ViewStyle; tone?: 'good' | 'bad' }) {
  const p = usePalette()
  const accent = tone === 'good' ? p.green : tone === 'bad' ? p.red : null
  return (
    <View style={[{
      backgroundColor: p.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm,
      borderWidth: 1, borderColor: p.border,
    }, accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null, style]}>
      {children}
    </View>
  )
}

export function H2({ children }: { children: ReactNode }) {
  const p = usePalette()
  return <Text accessibilityRole="header" style={{ fontSize: font.small, fontWeight: '600', color: p.t2, textTransform: 'uppercase', letterSpacing: 0.6 }}>{children}</Text>
}

export function T({ children, size = 'body', tone = 't1', weight, style, numberOfLines, accessibilityRole }: {
  children: ReactNode
  size?: keyof typeof font
  tone?: 't1' | 't2' | 't3' | 'green' | 'red' | 'amber' | 'blue'
  weight?: TextStyle['fontWeight']
  style?: TextStyle
  numberOfLines?: number
  accessibilityRole?: AccessibilityRole
}) {
  const p = usePalette()
  return <Text accessibilityRole={accessibilityRole} numberOfLines={numberOfLines} style={[{ fontSize: font[size], color: p[tone], fontWeight: weight }, style]}>{children}</Text>
}

export function Button({ title, onPress, kind = 'primary', disabled, accessibilityHint }: {
  title: string
  onPress: PressableProps['onPress']
  kind?: 'primary' | 'quiet' | 'danger'
  disabled?: boolean
  accessibilityHint?: string
}) {
  const p = usePalette()
  const bg = kind === 'primary' ? p.t1 : 'transparent'
  const fg = kind === 'primary' ? p.bg : kind === 'danger' ? p.red : p.t1
  return (
    <Pressable
      accessibilityRole="button" accessibilityHint={accessibilityHint} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({
        minHeight: touch, paddingHorizontal: space.xl, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
        backgroundColor: bg, borderWidth: kind === 'primary' ? 0 : 1, borderColor: kind === 'danger' ? p.red : p.borderMd,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: fg, fontSize: font.body, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  )
}

/** A thin bar showing a share (0–1) of a whole. */
export function ShareBar({ share, color }: { share: number; color: string }) {
  const p = usePalette()
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: p.surface2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%`, height: '100%', backgroundColor: color }} />
    </View>
  )
}

// ── Form pieces ──────────────────────────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T weight="600">{label}</T>
      {hint ? <T size="small" tone="t2">{hint}</T> : null}
      {children}
    </View>
  )
}

/** Pick one of a few options (a row of buttons; wraps when there are many). */
export function Choice({ options, value, onChange, wrap, label }: {
  options: { key: string; label: string }[]
  value: string
  onChange: (k: string) => void
  wrap?: boolean
  label?: string
}) {
  const p = usePalette()
  return (
    <View style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: space.xs }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(o => {
        const on = o.key === value
        return (
          <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.key)}
            style={{ minHeight: touch, flexGrow: wrap ? 0 : 1, flexBasis: wrap ? undefined : 0, paddingHorizontal: space.md, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
              backgroundColor: on ? p.t1 : p.surface, borderWidth: 1, borderColor: on ? p.t1 : p.borderMd }}>
            <Text style={{ fontSize: font.small, fontWeight: '600', color: on ? p.bg : p.t1 }}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function useInputStyle(): TextStyle {
  const p = usePalette()
  return { minHeight: touch, borderWidth: 1, borderColor: p.borderMd, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: font.body, color: p.t1, backgroundColor: p.surface }
}

export function TextField({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  const p = usePalette()
  const input = useInputStyle()
  return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={p.t3} style={input} accessibilityLabel={label} />
}

/** Reads a typed amount ("$1,200") as a number; NaN when it isn't one. */
export const parseAmount = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(/[$,\s]/g, '')))

/**
 * A number (dollars unless `unit` says otherwise). With `typical`, an empty
 * field offers a typical figure to use — offered, never assumed.
 */
export function NumberField({ value, onChange, label, unit = '$', typical, typicalNote }: {
  value: string
  onChange: (v: string) => void
  label: string
  unit?: '$' | '%' | 'years' | ''
  typical?: number
  typicalNote?: string
}) {
  const p = usePalette()
  const input = useInputStyle()
  const shown = (n: number) => (unit === '$' ? `$${n.toLocaleString('en-AU')}` : unit === '%' ? `${n}%` : unit === 'years' ? `${n} years` : String(n))
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {unit === '$' ? <T tone="t2">$</T> : null}
        <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={p.t3}
          style={[input, { flex: 1 }]} accessibilityLabel={label} />
        {unit === '%' || unit === 'years' ? <T tone="t2">{unit}</T> : null}
      </View>
      {typical !== undefined && value.trim() === '' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Use ${shown(typical)}${typicalNote ? `, ${typicalNote}` : ''}`} onPress={() => onChange(String(typical))}
          style={{ alignSelf: 'flex-start', minHeight: touch, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: p.blueLt }}>
          <Text style={{ fontSize: font.small, color: p.blue }}>
            <Text style={{ fontWeight: '600' }}>Use {shown(typical)}</Text>{typicalNote ? ` · ${typicalNote}` : ''}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
