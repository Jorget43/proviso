// Add or change a big one-off cost in a future year (?id= to change).

import { useState } from 'react'
import { Alert, Platform, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useHousehold } from '@/data/DataProvider'
import { saveOneOff, removeOneOff } from '@/data/future'
import { Button, Field, NumberField, Sheet, T, TextField, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

export default function OneOff() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { household, change } = useHousehold()
  const existing = params.id ? household.oneOffs.find(o => o.id === params.id) : undefined
  const thisYear = new Date().getFullYear()

  const [name, setName] = useState(existing?.name ?? '')
  const [amt, setAmt] = useState(existing ? String(existing.amt) : '')
  const [year, setYear] = useState(String(existing?.year ?? thisYear + 1))
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amount = parseAmount(amt), y = parseAmount(year)
    if (!name.trim()) { setError('Give it a name.'); return }
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter how much it costs.'); return }
    if (!Number.isInteger(y) || y < thisYear || y > thisYear + 50) { setError(`Pick a year from ${thisYear} on.`); return }
    await change(db => saveOneOff(db, existing?.id ?? null, { name, amt: amount, year: y }))
    router.back()
  }

  async function remove() {
    if (!existing) return
    const go = async () => { await change(db => removeOneOff(db, existing.id)); router.back() }
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`Remove “${existing.name}”?`)) await go(); return }
    Alert.alert(`Remove “${existing.name}”?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: go }])
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: existing ? 'Change a one-off cost' : 'Add a one-off cost' }} />
      <Field label="What is it?">
        <TextField label="What is it?" value={name} onChange={setName} placeholder="e.g. New car" />
      </Field>
      <Field label="How much?" hint="What you expect to pay at the time.">
        <NumberField label="How much" value={amt} onChange={setAmt} />
      </Field>
      <Field label="Which year?">
        <NumberField unit="" label="Which year" value={year} onChange={setYear} />
      </Field>
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
        {existing && <Button kind="danger" title="Remove" onPress={remove} />}
      </View>
    </Sheet>
  )
}
