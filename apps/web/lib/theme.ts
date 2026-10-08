// The appearance choice, shared by server and client code: follow the
// device (default), or always light, or always dark. Saved per user account
// (User.themePreference) and written on <html data-theme> by app/layout.tsx.

export type ThemeChoice = 'system' | 'light' | 'dark'
export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark']
export const isThemeChoice = (v: unknown): v is ThemeChoice => THEME_CHOICES.includes(v as ThemeChoice)
