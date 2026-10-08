// Preferences that belong to this device and the person using it, not the
// household: never in the household database, so they don't sync to a
// partner's phone. Kept with expo-secure-store (localStorage on the web build),
// the same small key-value store the household identity uses.

import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import type { ThemeChoice } from '@/ui/theme'

const THEME = 'proviso.theme'
const web = Platform.OS === 'web'

async function get(name: string): Promise<string | null> {
  if (web) { try { return globalThis.localStorage?.getItem(name) ?? null } catch { return null } }
  return SecureStore.getItemAsync(name)
}
async function set(name: string, value: string): Promise<void> {
  if (web) { try { globalThis.localStorage?.setItem(name, value) } catch { /* private window */ } return }
  await SecureStore.setItemAsync(name, value)
}

export async function loadThemeChoice(): Promise<ThemeChoice> {
  const v = await get(THEME).catch(() => null)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export async function saveThemeChoice(c: ThemeChoice): Promise<void> {
  await set(THEME, c).catch(() => { /* not saved: the choice still applies until the app closes */ })
}
