// Who's in the household: names, the years they were born, and whether
// there's a partner. Ages follow from the birth year, so they never go stale.

import { possessive } from '@proviso/core/formatting'
import { currentAges } from '@proviso/core/people'
import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useHousehold } from '@/data/DataProvider'
import { savePeople } from '@/data/settings'
import { Button, Choice, Field, NumberField, Sheet, T, TextField, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]

export default function People() {
  const { household: h, change } = useHousehold()
  const [p1, setP1] = useState(h.settings.person1Name)
  const [p2, setP2] = useState(h.settings.partnerEnabled ? h.settings.person2Name : '')
  const [partner, setPartner] = useState(h.settings.partnerEnabled)
  const year = new Date().getFullYear()
  const ages = currentAges(h.income, year)
  const [born1, setBorn1] = useState(String(h.income.person1BirthYear ?? year - ages.person1Age))
  const [born2, setBorn2] = useState(String(h.income.person2BirthYear ?? year - ages.person2Age))
  const ageNote = (born: string) => {
    const y = parseAmount(born)
    return Number.isInteger(y) && born.length === 4 && year - y >= 0 ? `${year - y} this year.` : undefined
  }
  const [error, setError] = useState<string | null>(null)

  async function save() {
    let problem: string | null = null
    const birth = (v: string) => (v.trim() === '' ? null : parseAmount(v))
    await change(async db => {
      problem = await savePeople(db, { person1Name: p1, person2Name: p2, partnerEnabled: partner,
        person1BirthYear: birth(born1), person2BirthYear: partner ? birth(born2) : null }, year)
    })
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
      <Field label="Year you were born" hint={ageNote(born1)}>
        <NumberField unit="" label="Year you were born" value={born1} onChange={setBorn1} />
      </Field>
      <Field label="Do you share your finances with a partner?">
        <Choice label="Partner" options={YES_NO} value={partner ? 'yes' : 'no'} onChange={k => setPartner(k === 'yes')} />
      </Field>
      {partner && (
        <Field label="Their name">
          <TextField label="Partner’s name" value={p2} onChange={setP2} />
        </Field>
      )}
      {partner && (
        <Field label="Year they were born" hint={ageNote(born2)}>
          <NumberField unit="" label="Year your partner was born" value={born2} onChange={setBorn2} />
        </Field>
      )}
      {partner && !h.settings.partnerEnabled && <T size="small" tone="t2">Next, you’ll add their pay.</T>}
      {!partner && h.settings.partnerEnabled && (
        <T size="small" tone="amber">{possessive(h.settings.person2Name)} pay and super will stop counting. Their details are kept if you switch this back on.</T>
      )}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
      </View>
    </Sheet>
  )
}
