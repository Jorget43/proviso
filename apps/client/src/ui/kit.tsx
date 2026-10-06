// Small building blocks shared by every screen, styled only with tokens.

import type { ReactNode } from 'react'
import { Pressable, ScrollView, Text, View, type AccessibilityRole, type PressableProps, type TextStyle, type ViewStyle } from 'react-native'
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
