// Scans a QR code with the camera (iOS and Android). The web build has its
// own Scanner.web.tsx: there the code is pasted instead.

import { useState } from 'react'
import { View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Button, T } from './kit'
import { radius, space } from './theme'

export const canScan = true

export function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [done, setDone] = useState(false)

  if (!permission) return null
  if (!permission.granted) {
    return (
      <View style={{ gap: space.sm }}>
        <T tone="t2">Proviso needs the camera to scan the code on your other device. It’s only used here.</T>
        <View style={{ alignItems: 'flex-start' }}>
          <Button title={permission.canAskAgain ? 'Allow the camera' : 'Camera blocked: allow it in your phone’s settings'}
            disabled={!permission.canAskAgain} onPress={() => void requestPermission()} />
        </View>
      </View>
    )
  }
  return (
    <View style={{ height: 300, borderRadius: radius.lg, overflow: 'hidden' }}>
      <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={done ? undefined : r => { setDone(true); onCode(r.data) }} />
    </View>
  )
}
