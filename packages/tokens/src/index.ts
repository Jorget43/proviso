// Proviso design tokens (docs/architecture.md, D7; the proviso-ui skill).
// One source for colours, spacing, radii and type sizes. The light palette is
// the one the NAS web app uses (apps/web/app/globals.css :root); the legacy
// CSS will be generated from here when the web client moves to Expo. Screens
// use these names, never raw values.

export interface Palette {
  bg: string; surface: string; surface2: string
  border: string; borderMd: string
  t1: string; t2: string; t3: string          // text: primary, secondary, muted
  bar: string; barText: string                // top / tab bar
  blue: string; blueLt: string
  green: string; greenLt: string
  red: string; redLt: string
  amber: string; amberLt: string
  purple: string; purpleLt: string
  pink: string; pinkLt: string
  teal: string; tealLt: string
}

export const light: Palette = {
  bg: '#F5F2EC', surface: '#FFFFFF', surface2: '#FAFAF7',
  border: 'rgba(50,42,28,0.1)', borderMd: 'rgba(50,42,28,0.18)',
  t1: '#1A1610', t2: '#6A5F4A', t3: '#A09484',
  bar: '#1A1610', barText: '#F5F2EC',
  blue: '#1E5FA8', blueLt: '#EAF0FB',
  green: '#166B45', greenLt: '#E5F5EE',
  red: '#9B2525', redLt: '#FBEAEA',
  amber: '#8A5208', amberLt: '#FDF2E0',
  purple: '#5235A8', purpleLt: '#EEEBFB',
  pink: '#9B2560', pinkLt: '#FBEAF3',
  teal: '#0E6B6B', tealLt: '#E5F5F5',
}

// Same hues, lifted for contrast on dark surfaces (WCAG AA for text on surface).
export const dark: Palette = {
  bg: '#14120E', surface: '#1E1B16', surface2: '#24211B',
  border: 'rgba(245,242,236,0.1)', borderMd: 'rgba(245,242,236,0.18)',
  t1: '#F2EEE6', t2: '#BDB3A0', t3: '#8C8272',
  bar: '#0E0C09', barText: '#F2EEE6',
  blue: '#7FB0EC', blueLt: 'rgba(127,176,236,0.14)',
  green: '#6CC79A', greenLt: 'rgba(108,199,154,0.14)',
  red: '#EE8A8A', redLt: 'rgba(238,138,138,0.14)',
  amber: '#E3B061', amberLt: 'rgba(227,176,97,0.14)',
  purple: '#B3A2F0', purpleLt: 'rgba(179,162,240,0.14)',
  pink: '#EE8AB9', pinkLt: 'rgba(238,138,185,0.14)',
  teal: '#6CCACA', tealLt: 'rgba(108,202,202,0.14)',
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const

/** Type sizes in px. Body text and inputs stay ≥ 16 on phones (no iOS zoom on focus). */
export const font = { caption: 12, small: 14, body: 16, title: 20, hero: 34 } as const

/** Minimum touch target, px. */
export const touch = 44
