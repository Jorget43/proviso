// The current palette (light or dark, following the phone's setting) plus the
// shared spacing and type scale. Screens style with these, never raw values.

import { useColorScheme } from 'react-native'
import { light, dark, space, radius, font, touch, type Palette } from '@proviso/tokens'

export { space, radius, font, touch }
export type { Palette }

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light
}
