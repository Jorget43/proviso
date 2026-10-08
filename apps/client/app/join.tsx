// Join a household that already syncs: scan the code shown on one of its
// devices (Settings → Sync → Add a device), or paste it. With no device left
// to scan from, the sync server's address plus the recovery phrase (or the
// key saved in a password manager) brings the household back.

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useHousehold } from '@/data/DataProvider'
import { keyStoreName, keysFromStore } from '@/data/keyBackup'
import { Button, Card, Field, H2, Input, Screen, T } from '@/ui/kit'
import { Scanner, canScan } from '@/ui/Scanner'
import { usePalette, space, radius } from '@/ui/theme'

export default function Join() {
  const { household, sync } = useHousehold()
  const p = usePalette()
  const [pasted, setPasted] = useState('')
  const [address, setAddress] = useState('')
  const [phrase, setPhrase] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanKey, setScanKey] = useState(0)

  async function attempt(fn: () => Promise<void>) {
    setError(null); setWorking(true)
    try {
      await fn()
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.')
      setScanKey(k => k + 1)   // let the camera scan again
    } finally {
      setWorking(false)
    }
  }

  async function recoverWithSavedKey() {
    const keys = await keysFromStore()
    if (!keys.length) throw new Error(`No Proviso key was found in ${keyStoreName}. Use your recovery phrase instead.`)
    let last: unknown = null
    for (const k of keys) {
      try { await sync.recover(address, k.key); return } catch (e) { last = e }
    }
    throw last
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
      {canScan && !working && <Scanner key={scanKey} onCode={c => void attempt(() => sync.join(c))} />}
      <Card>
        <Field label={canScan ? 'Or paste the code' : 'Join code'}>
          <Input value={pasted} onChangeText={setPasted} placeholder="proviso://join?…" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Join code" />
        </Field>
        <View style={{ alignItems: 'flex-start' }}>
          <Button title={working ? 'Joining…' : 'Join'} disabled={working || !pasted.trim()} onPress={() => void attempt(() => sync.join(pasted))} />
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        <H2>No other device to scan from?</H2>
        <Card>
          <T tone="t2">If your household synced, it’s still on your sync server. Enter the server’s address and your 24-word recovery phrase.</T>
          <Field label="Sync server address">
            <Input value={address} onChangeText={setAddress} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Sync server address" />
          </Field>
          <Field label="Recovery phrase">
            <Input value={phrase} onChangeText={setPhrase} multiline autoCapitalize="none" autoCorrect={false} spellCheck={false}
              placeholder="word word word …" accessibilityLabel="Recovery phrase" style={{ minHeight: 100, paddingTop: space.sm, textAlignVertical: 'top' }} />
          </Field>
          <View style={{ gap: space.sm }}>
            <Button title={working ? 'Fetching…' : 'Get my household back'} disabled={working || !address.trim() || !phrase.trim()}
              onPress={() => void attempt(() => sync.recover(address, phrase))} />
            {keyStoreName && (
              <Button kind="quiet" title={`Use the key saved in ${keyStoreName}`} disabled={working || !address.trim()}
                onPress={() => void attempt(recoverWithSavedKey)} />
            )}
          </View>
        </Card>
      </View>

      {working && <T tone="t2">Fetching your household…</T>}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
    </Screen>
  )
}
