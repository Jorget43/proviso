// Rent: whether you rent, how much, and how fast it goes up.

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { fmt } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { saveRent } from '@/data/settings'
import { Button, Choice, Field, NumberField, Sheet, T, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]

export default function Rent() {
  const { household: h, change } = useHousehold()
  const [renting, setRenting] = useState(h.rent.enabled)
  const [weekly, setWeekly] = useState(h.rent.monthlyRent > 0 ? String(Math.round(h.rent.monthlyRent * 12 / 52)) : '')
  const [rise, setRise] = useState(String(h.rent.annualIncreaseRate))
  const [error, setError] = useState<string | null>(null)

  const w = parseAmount(weekly)
  async function save() {
    const r = parseAmount(rise)
    if (renting && (!Number.isFinite(w) || w <= 0)) { setError('Enter the rent each week.'); return }
    if (renting && (!Number.isFinite(r) || r < 0 || r > 30)) { setError('Check the yearly rise.'); return }
    await change(db => saveRent(db, { enabled: renting, monthlyRent: Math.round(w * 52 / 12), annualIncreaseRate: r }))
    router.back()
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: 'Rent' }} />
      <Field label="Do you rent your home?">
        <Choice label="Renting" options={YES_NO} value={renting ? 'yes' : 'no'} onChange={k => setRenting(k === 'yes')} />
      </Field>
      {renting && (
        <>
          <Field label="Rent each week">
            <NumberField label="Rent each week" value={weekly} onChange={setWeekly} />
          </Field>
          {Number.isFinite(w) && w > 0 && <T tone="t2">That’s about {fmt(w * 52 / 12)} a month.</T>}
          <Field label="How much it goes up each year" hint="Used for the long-term plan.">
            <NumberField unit="%" label="Yearly rent rise, percent" value={rise} onChange={setRise} />
          </Field>
        </>
      )}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
      </View>
    </Sheet>
  )
}
