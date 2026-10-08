// The current palette plus the shared spacing and type scale. Screens style
// with these, never raw values. Light or dark follows the person's choice in
// Settings → Appearance (ThemeProvider), which by default matches the phone.

import { createContext, useContext } from 'react'
import { useColorScheme } from 'react-native'
import { light, dark, space, radius, font, touch, type Palette } from '@proviso/tokens'

export { space, radius, font, touch }
export type { Palette }

export type ThemeChoice = 'system' | 'light' | 'dark'

export const ThemeChoiceContext = createContext<{ choice: ThemeChoice; setChoice: (c: ThemeChoice) => void }>({
  choice: 'system', setChoice: () => {},
})

/** The choice and a way to change it (Settings → Appearance). */
export const useThemeChoice = () => useContext(ThemeChoiceContext)

/** True when the app is showing its dark palette. */
export function useIsDark(): boolean {
  const { choice } = useContext(ThemeChoiceContext)
  const device = useColorScheme()
  return choice === 'system' ? device === 'dark' : choice === 'dark'
}

export function usePalette(): Palette {
  return useIsDark() ? dark : light
}
