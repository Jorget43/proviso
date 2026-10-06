// First run on a device: start a new household, or bring one in from a
// backup or a NAS export (app/restore.tsx).

import { View } from 'react-native'
import { router } from 'expo-router'
import { Button, Card, Screen, T } from '@/ui/kit'
import { space } from '@/ui/theme'

export default function Welcome() {
  // The questionnaire creates the household when it's saved.
  const startFresh = () => router.push('/setup')

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <T size="hero" weight="700">Proviso</T>
        <T tone="t2">See where your money goes each month, and where you’re headed. Your data stays on your devices.</T>
      </View>

      <Card>
        <T weight="600">New here?</T>
        <T tone="t2">Answer a few questions (about two minutes) and we’ll suggest typical costs for a household like yours, ready to adjust.</T>
        <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
          <Button title="Get started" onPress={startFresh} />
        </View>
      </Card>

      <Card>
        <T weight="600">Bringing your data across?</T>
        <T tone="t2">Choose a Proviso backup (you’ll need your recovery phrase), or a file from Proviso on a home server (Settings → Download all your data).</T>
        <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
          <Button kind="quiet" title="Choose the file" onPress={() => router.push('/restore')} />
        </View>
      </Card>
    </Screen>
  )
}
