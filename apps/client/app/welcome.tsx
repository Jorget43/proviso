// First run on a device: start a new household, or bring one across from
// Proviso on a NAS (Settings → Download all your data there).

import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { useHousehold } from '@/data/DataProvider'
import { Button, Card, Screen, T } from '@/ui/kit'
import { space } from '@/ui/theme'

export default function Welcome() {
  const { change, importFile } = useHousehold()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[] | null>(null)

  async function startFresh() {
    await change((db, m) => m.saveSettings(db, 'householdSettings', { onboardingDone: false }))
    router.replace('/')
  }

  async function bringIn() {
    setError(null)
    const pick = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true })
    if (pick.canceled) return
    setBusy(true)
    try {
      const asset = pick.assets[0]
      const text = asset.file ? await asset.file.text() : await new File(asset.uri).text()
      let json: unknown
      try { json = JSON.parse(text) } catch { throw new Error('That file isn’t a Proviso export — it couldn’t be read.') }
      const r = await importFile(json)
      if (r.notes.length) setNotes(r.notes)
      else router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong reading that file.')
    } finally {
      setBusy(false)
    }
  }

  if (notes) {
    return (
      <Screen>
        <T size="title" weight="700">Your data is in</T>
        <Card>
          <T weight="600">A few things to check</T>
          {notes.map(n => <T key={n} tone="t2">• {n}</T>)}
        </Card>
        <Button title="Continue" onPress={() => router.replace('/')} />
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <T size="hero" weight="700">Proviso</T>
        <T tone="t2">See where your money goes each month, and where you’re headed. Your data stays on your devices.</T>
      </View>

      <Card>
        <T weight="600">New here?</T>
        <T tone="t2">Start with an empty household and add your pay and regular costs.</T>
        <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
          <Button title="Start fresh" onPress={startFresh} disabled={busy} />
        </View>
      </Card>

      <Card>
        <T weight="600">Already using Proviso on a home server?</T>
        <T tone="t2">On the server, open Settings → Download all your data. Then choose that file here.</T>
        <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
          <Button kind="quiet" title={busy ? 'Reading…' : 'Choose the file'} onPress={bringIn} disabled={busy} />
        </View>
        {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      </Card>
    </Screen>
  )
}
