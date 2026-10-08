'use client'
// Chart colours for the current theme. Canvas drawing can't read CSS
// variables, so charts take resolved colours from here: the same palette as
// the stylesheet (packages/tokens), switching when <html data-theme> changes
// (Settings → Appearance) or, on "system", when the device's setting does.

import { useSyncExternalStore } from 'react'
import { light, dark, type Palette } from '@proviso/tokens'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isDarkNow(): boolean {
  const t = document.documentElement.dataset.theme
  if (t === 'dark') return true
  if (t === 'light') return false
  return window.matchMedia?.(DARK_QUERY).matches ?? false
}

function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const mq = window.matchMedia?.(DARK_QUERY)
  mq?.addEventListener('change', onChange)
  return () => { mo.disconnect(); mq?.removeEventListener('change', onChange) }
}

/** A colour from the palette at a given opacity. */
export function alpha(color: string, a: number): string {
  const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (rgba) return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${a})`
  const h = color.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export interface ChartColors extends Palette {
  dark: boolean
  /** Gridlines: barely there in either theme. */
  grid: string
  a:    typeof alpha
}

export function useChartColors(): ChartColors {
  const isDark = useSyncExternalStore(subscribe, isDarkNow, () => false)
  const p = isDark ? dark : light
  return { ...p, dark: isDark, grid: isDark ? 'rgba(245,242,236,0.07)' : 'rgba(0,0,0,0.05)', a: alpha }
}

/** Axis labels in the theme's quietest text colour. */
export const axisTicks = (c: ChartColors) => ({ font: { size: 10 }, color: c.t3 }) as const
