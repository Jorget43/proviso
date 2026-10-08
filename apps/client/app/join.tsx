// Join a household that already syncs: scan the code shown on one of its
// devices (Settings → Sync → Add a device), or paste it.

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useHousehold } from '@/data/DataProvider'
import { Button, Card, Field, Input, Screen, T } from '@/ui/kit'
import { Scanner, canScan } from '@/ui/Scanner'
import { usePalette, space, radius } from '@/ui/theme'

export default function Join() {
  const { household, sync } = useHousehold()
  const p = usePalette()
  const [pasted, setPasted] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanKey, setScanKey] = useState(0)

  async function join(code: string) {
    setError(null); setWorking(true)
    try {
      await sync.join(code)
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.')
      setScanKey(k => k + 1)   // let the camera scan again
    } finally {
      setWorking(false)
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Join a household' }} />
      <T>On a device that already has your household, open Settings → Sync → Add a device, then {canScan ? 'scan the code it shows' : 'send the code to this device and paste it here'}.</T>
      {household.exists && (
        <View style={{ backgroundColor: p.amberLt, borderRadius: radius.md, padding: space.md }}>
          <T>The household on this device will be replaced by the one you join. Save a backup first if you want to keep it.</T>
        </View>
      )}
      {canScan && !working && <Scanner key={scanKey} onCode={c => void join(c)} />}
      <Card>
        <Field label={canScan ? 'Or paste the code' : 'Join code'}>
          <Input value={pasted} onChangeText={setPasted} placeholder="proviso://join?…" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Join code" />
        </Field>
        <View style={{ alignItems: 'flex-start' }}>
          <Button title={working ? 'Joining…' : 'Join'} disabled={working || !pasted.trim()} onPress={() => void join(pasted)} />
        </View>
      </Card>
      {working && <T tone="t2">Fetching your household…</T>}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
    </Screen>
  )
}
