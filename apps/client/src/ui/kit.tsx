// Small building blocks shared by every screen, styled only with tokens.

import { createContext, useContext, useId, type ReactNode } from 'react'
import {
  InputAccessoryView, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View,
  type AccessibilityRole, type PressableProps, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette, space, radius, font, touch } from './theme'

// ── Keyboard ─────────────────────────────────────────────────────────────────
// iOS number pads have no return key, so every screen with inputs gets a
// "Done" bar above the keyboard (an InputAccessoryView). Each scroll container
// owns one, with its own id, so screens kept mounted in the stack don't clash.
// Dragging the page also puts the keyboard away.

const DoneId = createContext<string | undefined>(undefined)

function KeyboardDone({ id }: { id: string }) {
  const p = usePalette()
  if (Platform.OS !== 'ios') return null
  return (
    <InputAccessoryView nativeID={id}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: p.surface2, borderTopWidth: 1, borderTopColor: p.border }}>
        <Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()}
          style={{ minHeight: touch, paddingHorizontal: space.lg, justifyContent: 'center' }}>
          <Text style={{ fontSize: font.body, fontWeight: '600', color: p.blue }}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  )
}

function Scroll({ children, maxWidth, bottom }: { children: ReactNode; maxWidth: number; bottom: number }) {
  const p = usePalette()
  const id = useId()
  return (
    <DoneId.Provider value={id}>
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: bottom, gap: space.lg, maxWidth, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {children}
      </ScrollView>
      <KeyboardDone id={id} />
    </DoneId.Provider>
  )
}

/** A tab's page. */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return <Scroll maxWidth={720} bottom={space.xxl + insets.bottom}>{children}</Scroll>
}

/** A form presented over a tab (add a cost, change pay). */
export function Sheet({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return <Scroll maxWidth={560} bottom={space.xl + insets.bottom}>{children}</Scroll>
}

/** A text box styled from tokens, with the Done bar on iOS. */
export function Input({ style, ...props }: TextInputProps) {
  const p = usePalette()
  const base = useInputStyle()
  const done = useContext(DoneId)
  return <TextInput placeholderTextColor={p.t3} returnKeyType="done" inputAccessoryViewID={done} {...props} style={[base, style]} />
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
            style={{ minHeight: touch, minWidth: touch, flexGrow: wrap ? 0 : 1, flexBasis: wrap ? undefined : 0, paddingHorizontal: wrap ? space.md : space.xs, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
              backgroundColor: on ? p.t1 : p.surface, borderWidth: 1, borderColor: on ? p.t1 : p.borderMd }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: font.small, fontWeight: '600', color: on ? p.bg : p.t1 }}>{o.label}</Text>
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
  return <Input value={value} onChangeText={onChange} placeholder={placeholder} accessibilityLabel={label} />
}

/**
 * A number nudged down and up in fixed steps: a slider's job, but exact and
 * easy to hit. Screen readers adjust it with the usual swipe up / down.
 */
export function Stepper({ label, value, onChange, min, max, step, format = String }: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
}) {
  const p = usePalette()
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Number((Math.round(v / step) * step).toFixed(4)))))
  const shown = format(value)
  const button = (sign: '−' | '+', next: number, disabled: boolean) => (
    <Pressable accessible={false} disabled={disabled} onPress={() => set(next)} hitSlop={space.xs}
      style={({ pressed }) => ({ width: touch, height: touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: p.borderMd, backgroundColor: p.surface, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}>
      <Text style={{ fontSize: font.title, color: p.t1 }}>{sign}</Text>
    </Pressable>
  )
  return (
    <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: shown }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => set(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <T style={{ flex: 1 }}>{label}</T>
      {button('−', value - step, value <= min)}
      <T weight="600" style={{ minWidth: 76, textAlign: 'center' }}>{shown}</T>
      {button('+', value + step, value >= max)}
    </View>
  )
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
  const shown = (n: number) => (unit === '$' ? `$${n.toLocaleString('en-AU')}` : unit === '%' ? `${n}%` : unit === 'years' ? `${n} years` : String(n))
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {unit === '$' ? <T tone="t2">$</T> : null}
        <Input value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" style={{ flex: 1 }} accessibilityLabel={label} />
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
