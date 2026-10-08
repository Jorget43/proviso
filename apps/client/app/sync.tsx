// Settings → Sync: share the household with a partner's phone or your other
// devices through a sync server (docs/architecture.md, D5). The server only
// ever holds encrypted changes.

import { useState } from 'react'
import { Share, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useHousehold } from '@/data/DataProvider'
import { Button, Card, Field, H2, Input, Screen, T } from '@/ui/kit'
import { QrCode } from '@/ui/QrCode'
import { confirmAction } from '@/ui/confirm'
import { usePalette, space, radius } from '@/ui/theme'

function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'not yet'
  const s = Math.round((now - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString('en-AU')
}

export default function SyncScreen() {
  const { sync } = useHousehold()
  const p = usePalette()
  const [address, setAddress] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const s = sync.state

  async function attempt(fn: () => Promise<unknown>) {
    setError(null); setWorking(true)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'That didn’t work. Try again.') } finally { setWorking(false) }
  }

  if (!s) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Sync' }} />
        <Card>
          <T>Share this household with a partner’s phone or your other devices. Changes travel through a sync server, locked with your household key: the server can’t read them.</T>
          <Field label="Sync server address" hint="Your NAS’s Tailscale address, the one ending in .ts.net. It has to start with https.">
            <Input value={address} onChangeText={setAddress} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Sync server address" />
          </Field>
          {error && <T tone="red" accessibilityRole="alert">{error}</T>}
          <View style={{ alignItems: 'flex-start' }}>
            <Button title={working ? 'Connecting…' : 'Turn on sync'} disabled={working || !address.trim()} onPress={() => attempt(() => sync.turnOn(address))} />
          </View>
        </Card>
        <View style={{ gap: space.sm }}>
          <H2>Joining a household that already syncs?</H2>
          <Card>
            <T tone="t2">Scan the code from the other device. What’s on this device is replaced by that household.</T>
            <View style={{ alignItems: 'flex-start' }}>
              <Button kind="quiet" title="Join a household" onPress={() => router.push('/join')} />
            </View>
          </Card>
        </View>
      </Screen>
    )
  }

  const host = s.relay.replace(/^https?:\/\//, '')
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sync' }} />
      <Card>
        <T weight="600">Syncing with {host}</T>
        <T tone="t2">Last synced {ago(s.lastSyncedAt)}.{s.unsent > 0 ? ` ${s.unsent} change${s.unsent === 1 ? '' : 's'} waiting to send.` : ''}</T>
        {s.needsUpdate && (
          <View style={{ backgroundColor: p.amberLt, borderRadius: radius.md, padding: space.md }}>
            <T>Another device has a newer version of Proviso. Update this app so its changes can show here; nothing is lost meanwhile.</T>
          </View>
        )}
        {(error ?? sync.error) && <T tone="red" accessibilityRole="alert">{error ?? sync.error}</T>}
        <View style={{ alignItems: 'flex-start' }}>
          <Button kind="quiet" title={sync.busy || working ? 'Syncing…' : 'Sync now'} disabled={sync.busy || working} onPress={() => attempt(sync.now)} />
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        <H2>Add a device</H2>
        <Card>
          <T tone="t2">On the other device, install Proviso, choose “Join a household”, and scan this code.</T>
          {code ? (
            <>
              <QrCode value={code} label="Join code for this household" />
              <View style={{ backgroundColor: p.amberLt, borderRadius: radius.md, padding: space.md }}>
                <T>Anyone who scans this code gets your household. Show it only to your own devices, and hide it when you’re done.</T>
              </View>
              <Field label="The same code as text" hint="For a device that can’t scan, like a computer: copy it there and paste it into “Join a household”.">
                <Input value={code} editable={false} selectTextOnFocus accessibilityLabel="Join code as text" />
              </Field>
              <View style={{ gap: space.sm }}>
                <Button kind="quiet" title="Send the code" accessibilityHint="Opens the share sheet" onPress={() => void Share.share({ message: code }).catch(() => {})} />
                <Button title="Hide the code" onPress={() => setCode(null)} />
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'flex-start' }}>
              <Button title="Show the code" onPress={() => attempt(async () => setCode(await sync.joinCode()))} />
            </View>
          )}
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Stop syncing</H2>
        <Card>
          <T tone="t2">Stopping on this device keeps your household here and on your other devices; this one just stops sharing changes.</T>
          <View style={{ gap: space.sm }}>
            <Button kind="quiet" title="Stop syncing on this device" onPress={() => confirmAction('Stop syncing on this device?',
              'Your household stays on this device, but changes here and on your other devices won’t reach each other.', 'Stop syncing', () => void attempt(sync.stop))} />
            <Button kind="danger" title="Delete from the sync server" onPress={() => confirmAction('Delete from the sync server?',
              'Removes your household from the sync server. Every device keeps its own copy, but none of them will sync until it’s set up again.', 'Delete', () => void attempt(sync.deleteFromServer))} />
          </View>
        </Card>
      </View>
    </Screen>
  )
}
