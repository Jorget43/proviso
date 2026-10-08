// A QR code drawn with plain Views: no native module, so it works in Expo
// Go, development builds and the web build alike. Always black on white with
// a quiet zone, whatever the theme, so every camera can read it.

import { View } from 'react-native'
import makeQr from 'qrcode-generator'

// Pure black on white in both themes, not palette colours: cameras need the contrast.
const INK = '#000000'
const PAPER = '#FFFFFF'

export function QrCode({ value, size = 260, label }: { value: string; size?: number; label: string }) {
  const qr = makeQr(0, 'M')
  qr.addData(value)
  qr.make()
  const n = qr.getModuleCount()
  const quiet = 4
  const cell = Math.floor(size / (n + quiet * 2))
  const rows = Array.from({ length: n }, (_, r) => r)
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}
      style={{ backgroundColor: PAPER, padding: cell * quiet, alignSelf: 'center' }}>
      {rows.map(r => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {rows.map(c => <View key={c} style={{ width: cell, height: cell, backgroundColor: qr.isDark(r, c) ? INK : PAPER }} />)}
        </View>
      ))}
    </View>
  )
}
