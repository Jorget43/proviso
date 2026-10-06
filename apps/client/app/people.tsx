// Who's in the household: names, and whether there's a partner.

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useHousehold } from '@/data/DataProvider'
import { savePeople } from '@/data/settings'
import { Button, Choice, Field, Sheet, T, TextField } from '@/ui/kit'
import { space } from '@/ui/theme'

const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]

export default function People() {
  const { household: h, change } = useHousehold()
  const [p1, setP1] = useState(h.settings.person1Name)
  const [p2, setP2] = useState(h.settings.partnerEnabled ? h.settings.person2Name : '')
  const [partner, setPartner] = useState(h.settings.partnerEnabled)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    let problem: string | null = null
    await change(async db => { problem = await savePeople(db, { person1Name: p1, person2Name: p2, partnerEnabled: partner }) })
    if (problem) { setError(problem); return }
    // A new partner's pay comes next.
    if (partner && !h.settings.partnerEnabled) router.replace('/income')
    else router.back()
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: 'People' }} />
      <Field label="Your name">
        <TextField label="Your name" value={p1} onChange={setP1} />
      </Field>
      <Field label="Do you share your finances with a partner?">
        <Choice label="Partner" options={YES_NO} value={partner ? 'yes' : 'no'} onChange={k => setPartner(k === 'yes')} />
      </Field>
      {partner && (
        <Field label="Their name">
          <TextField label="Partner’s name" value={p2} onChange={setP2} />
        </Field>
      )}
      {partner && !h.settings.partnerEnabled && <T size="small" tone="t2">Next, you’ll add their pay.</T>}
      {!partner && h.settings.partnerEnabled && (
        <T size="small" tone="amber">{h.settings.person2Name}’s pay and super will stop counting. Their details are kept if you switch this back on.</T>
      )}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
      </View>
    </Sheet>
  )
}
