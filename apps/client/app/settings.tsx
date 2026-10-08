// Settings: who's in the household, rent and childcare, and the data itself:
// the recovery phrase, backups, restoring, and starting again.

import { useCallback, useState } from 'react'
import { Alert, Platform, Pressable, View } from 'react-native'
import { router, Stack, useFocusEffect } from 'expo-router'
import Constants from 'expo-constants'
import { encryptBackup } from '@proviso/core/backup'
import { fmt } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { useIdentity } from '@/data/useIdentity'
import { exportHousehold } from '@/data/importExport'
import { shareJson, datedName } from '@/data/files'
import { keyStoreName, saveKeyToStore } from '@/data/keyBackup'
import { keyInStore } from '@/data/identity'
import { Button, Card, H2, Screen, T } from '@/ui/kit'
import { usePalette, space, radius, touch } from '@/ui/theme'

const APP_VERSION = Constants.expoConfig?.version ?? '0'

export default function Settings() {
  const { household: h, read, erase, sync } = useHousehold()
  const identity = useIdentity()
  const p = usePalette()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inStore, setInStore] = useState<boolean | null>(null)
  const [storeMsg, setStoreMsg] = useState<string | null>(null)
  useFocusEffect(useCallback(() => { void keyInStore().then(setInStore) }, []))

  async function saveToStore() {
    if (!identity) return
    setStoreMsg(null); setBusy('store')
    try {
      const saved = await saveKeyToStore(identity)
      setInStore(await keyInStore())
      setStoreMsg(saved ? null : 'Not saved. You can try again any time.')
    } catch (e) {
      setStoreMsg(e instanceof Error ? e.message : 'That didn’t work. Try again.')
    } finally {
      setBusy(null)
    }
  }

  async function save(kind: 'backup' | 'copy') {
    if (!identity) return
    setError(null); setBusy(kind)
    try {
      const doc = await read(db => exportHousehold(db, identity.householdId, { includeRemoved: kind === 'backup', appVersion: APP_VERSION }))
      if (kind === 'backup') await shareJson(datedName('proviso-backup'), encryptBackup(doc, identity.key), 'Save your Proviso backup')
      else await shareJson(datedName('proviso-data'), doc, 'Save a copy of your Proviso data')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.')
    } finally {
      setBusy(null)
    }
  }

  function startAgain() {
    const go = async () => { await erase(); router.replace('/welcome') }
    const msg = 'This removes your household from this phone. Without a backup and your recovery phrase, it can’t be brought back.'
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`Start again?\n\n${msg}`)) void go(); return }
    Alert.alert('Start again?', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove everything', style: 'destructive', onPress: () => void go() }])
  }

  const people = h.settings.partnerEnabled ? `${h.settings.person1Name} and ${h.settings.person2Name}` : h.settings.person1Name

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Settings', headerShown: true }} />

      {identity && !identity.phraseSaved && (
        <View style={{ backgroundColor: p.amberLt, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
          <T weight="600">Set up your recovery phrase</T>
          <T>Your data lives only on this phone. If you lose it, your recovery phrase and a backup are the only way to get it back.</T>
          <View style={{ alignItems: 'flex-start' }}>
            <Button title="Set it up" onPress={() => router.push('/recovery')} />
          </View>
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <H2>Household</H2>
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          <Row label="People" value={people} onPress={() => router.push('/people')} first />
          <Row label="Rent" value={h.rent.enabled ? `${fmt(h.rent.monthlyRent)} a month` : 'Not renting'} onPress={() => router.push('/rent')} />
          <Row label="Childcare" value={h.childcare.enabled ? `${h.childcare.daysPerWeek} days a week` : 'None'} onPress={() => router.push('/childcare')} />
          <Row label="Pay" value="Salaries and days worked" onPress={() => router.push('/income')} />
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Sync</H2>
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          <Row label="Other devices" value={sync.state ? (sync.error ? 'Can’t sync right now' : 'Syncing') : 'This device only'} onPress={() => router.push('/sync')} first />
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Your data</H2>
        <Card>
          <T tone="t2">
            {sync.state
              ? 'Your household is on your devices, and encrypted on your sync server. A backup now and then is still worth keeping somewhere else: Files, Google Drive, Dropbox or email.'
              : 'Everything stays on this phone. Save a backup now and then, somewhere other than this phone: Files, Google Drive, Dropbox or email.'}
          </T>
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Button title={busy === 'backup' ? 'Preparing…' : 'Save a backup'} onPress={() => save('backup')} disabled={!identity || busy !== null}
              accessibilityHint="Encrypted. Opens with your recovery phrase." />
            <Button kind="quiet" title={busy === 'copy' ? 'Preparing…' : 'Save a readable copy'} onPress={() => save('copy')} disabled={!identity || busy !== null}
              accessibilityHint="Not encrypted. For your records or a spreadsheet." />
            <Button kind="quiet" title="Restore from a file" onPress={() => router.push('/restore')} />
          </View>
          <T size="small" tone="t2">A backup is encrypted: only your recovery phrase opens it. A readable copy isn’t, so keep it somewhere private.</T>
          {error && <T tone="red" accessibilityRole="alert">{error}</T>}
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Recovery phrase</H2>
        <Card>
          <T tone="t2">
            {identity?.phraseSaved
              ? 'You’ve written down your 24-word recovery phrase. You can look at it again here.'
              : '24 words that open your backups on a new phone. Write them down and keep them somewhere safe.'}
          </T>
          <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
            <Button kind="quiet" title={identity?.phraseSaved ? 'Show my recovery phrase' : 'Set up my recovery phrase'} onPress={() => router.push('/recovery')} />
          </View>
          {keyStoreName && (
            <View style={{ gap: space.sm, marginTop: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: p.border }}>
              <T tone="t2">
                {inStore
                  ? `Your household key is also saved in ${keyStoreName}. A new phone signed in to the same account can open your backups without the words.`
                  : `You can also save your household key in ${keyStoreName}. Then a new phone signed in to the same account can open your backups without the words. Keep the words as well.`}
              </T>
              {!inStore && (
                <View style={{ alignItems: 'flex-start' }}>
                  <Button kind="quiet" title={busy === 'store' ? 'Saving…' : `Save to ${keyStoreName}`} onPress={saveToStore} disabled={!identity || busy !== null} />
                </View>
              )}
              {storeMsg && <T tone="amber">{storeMsg}</T>}
            </View>
          )}
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Start again</H2>
        <Card>
          <T tone="t2">Removes your household from this phone. Save a backup first if you might want it back.</T>
          <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
            <Button kind="danger" title="Start again" onPress={startAgain} />
          </View>
        </Card>
      </View>

      <T size="caption" tone="t3" style={{ textAlign: 'center' }}>Proviso {APP_VERSION}</T>
    </Screen>
  )
}

function Row({ label, value, onPress, first }: { label: string; value: string; onPress: () => void; first?: boolean }) {
  const p = usePalette()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Change`} onPress={onPress}
      style={({ pressed }) => ({ minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm,
        borderTopWidth: first ? 0 : 1, borderTopColor: p.border, opacity: pressed ? 0.6 : 1 })}>
      <T weight="600" style={{ flex: 1 }}>{label}</T>
      <T tone="t2" numberOfLines={1} style={{ flexShrink: 1 }}>{value}</T>
      <T tone="t3">›</T>
    </Pressable>
  )
}
