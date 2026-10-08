// Restoring from a file: an encrypted backup (needs the recovery phrase) or
// a readable export (from the NAS, or a readable copy). Either replaces the
// household on this phone.

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { isBackupFile } from '@proviso/core/backup'
import { useHousehold } from '@/data/DataProvider'
import { pickJsonFile } from '@/data/files'
import { keyStoreName, keysFromStore } from '@/data/keyBackup'
import { Button, Card, Field, Input, Screen, T } from '@/ui/kit'
import { space } from '@/ui/theme'

export default function Restore() {
  const { household, importFile, restoreBackup } = useHousehold()
  const [file, setFile] = useState<unknown | null>(null)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[] | null>(null)

  async function choose() {
    setError(null)
    try {
      const json = await pickJsonFile()
      if (json === null) return
      if (isBackupFile(json)) { setFile(json); return }
      setBusy(true)
      const r = await importFile(json)
      if (r.notes.length) setNotes(r.notes); else router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file couldn’t be read.')
    } finally {
      setBusy(false)
    }
  }

  async function unlock() {
    setError(null); setBusy(true)
    try {
      await restoreBackup(file, phrase)
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.')
    } finally {
      setBusy(false)
    }
  }

  // The key saved in iCloud Keychain / Google Password Manager instead of the phrase: try each one found.
  async function unlockWithSavedKey() {
    setError(null); setBusy(true)
    try {
      const keys = await keysFromStore()
      if (!keys.length) { setError(`No Proviso key was found in ${keyStoreName}. Use your recovery phrase instead.`); return }
      for (const k of keys) {
        try { await restoreBackup(file, k.key); router.replace('/'); return } catch { /* not this household's key */ }
      }
      setError(`The key in ${keyStoreName} doesn’t open this backup. It may be from a different household: use your recovery phrase.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Restore', headerShown: true }} />

      {notes ? (
        <>
          <T size="title" weight="700">Your data is in</T>
          <Card>
            <T weight="600">A few things to check</T>
            {notes.map(n => <T key={n} tone="t2">• {n}</T>)}
          </Card>
          <Button title="Continue" onPress={() => router.replace('/')} />
        </>
      ) : file ? (
        <>
          <T size="title" weight="700">Enter your recovery phrase</T>
          <T tone="t2">The 24 words you wrote down when you set up Proviso, in order.</T>
          <Field label="Recovery phrase">
            <Input value={phrase} onChangeText={setPhrase} multiline autoCapitalize="none" autoCorrect={false} spellCheck={false}
              placeholder="word word word …" accessibilityLabel="Recovery phrase"
              style={{ minHeight: 132, paddingTop: space.sm, textAlignVertical: 'top' }} />
          </Field>
          {household.exists && <T size="small" tone="amber">This replaces the household that’s on this phone now.</T>}
          {error && <T tone="red" accessibilityRole="alert">{error}</T>}
          <Button title={busy ? 'Opening…' : 'Restore'} onPress={unlock} disabled={busy || phrase.trim() === ''} />
          {keyStoreName && <Button kind="quiet" title={`Use the key saved in ${keyStoreName}`} onPress={unlockWithSavedKey} disabled={busy} />}
          <Button kind="quiet" title="Choose a different file" onPress={() => { setFile(null); setPhrase(''); setError(null) }} />
        </>
      ) : (
        <>
          <T size="title" weight="700">Restore from a file</T>
          <T tone="t2">Choose a Proviso backup (you’ll need your recovery phrase) or a readable copy, including one downloaded from Proviso on a home server.</T>
          {household.exists && <T size="small" tone="amber">Restoring replaces the household that’s on this phone now.</T>}
          {error && <T tone="red" accessibilityRole="alert">{error}</T>}
          <View style={{ gap: space.sm }}>
            <Button title={busy ? 'Reading…' : 'Choose the file'} onPress={choose} disabled={busy} />
            <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
          </View>
        </>
      )}
    </Screen>
  )
}
