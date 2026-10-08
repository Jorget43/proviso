// Holds the Appearance choice for the whole app: match the phone (default),
// or always light / dark. Remembered on this device (src/data/devicePrefs.ts).
// On phones it also tells the system, so alerts, pickers and the keyboard
// match; the web build has no such override and follows the choice in our
// own colours only.

import { useEffect, useState, type ReactNode } from 'react'
import { Appearance } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { loadThemeChoice, saveThemeChoice } from '@/data/devicePrefs'
import { ThemeChoiceContext, useIsDark, type ThemeChoice } from './theme'

function tellSystem(choice: ThemeChoice) {
  const set = (Appearance as { setColorScheme?: (s: 'light' | 'dark' | 'unspecified') => void }).setColorScheme
  set?.(choice === 'system' ? 'unspecified' : choice)
}

function Bar() {
  return <StatusBar style={useIsDark() ? 'light' : 'dark'} />
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>('system')

  useEffect(() => {
    let alive = true
    void loadThemeChoice().then(c => { if (alive) { setChoiceState(c); tellSystem(c) } })
    return () => { alive = false }
  }, [])

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c)
    tellSystem(c)
    void saveThemeChoice(c)
  }

  return (
    <ThemeChoiceContext.Provider value={{ choice, setChoice }}>
      <Bar />
      {children}
    </ThemeChoiceContext.Provider>
  )
}
