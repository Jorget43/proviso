// Add or change a big one-off in a future year (?id= to change): a cost, or
// money coming in at once (@proviso/core/projections ONE_OFF_KINDS).

import { useState } from 'react'
import { Alert, Platform, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useHousehold } from '@/data/DataProvider'
import { saveOneOff, removeOneOff } from '@/data/future'
import { Button, Choice, Field, NumberField, Sheet, T, TextField, parseAmount } from '@/ui/kit'
import { ONE_OFF_KINDS, oneOffKindOf } from '@proviso/core/projections'
import { space } from '@/ui/theme'

export default function OneOff() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { household, change } = useHousehold()
  const existing = params.id ? household.oneOffs.find(o => o.id === params.id) : undefined
  const thisYear = new Date().getFullYear()

  const [kind, setKind] = useState(oneOffKindOf(existing?.kind).key as string)
  const [name, setName] = useState(existing?.name ?? '')
  const [amt, setAmt] = useState(existing ? String(existing.amt) : '')
  const [year, setYear] = useState(String(existing?.year ?? thisYear + 1))
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amount = parseAmount(amt), y = parseAmount(year)
    if (!name.trim()) { setError('Give it a name.'); return }
    if (!Number.isFinite(amount) || amount <= 0) { setError(kind === 'cost' ? 'Enter how much it costs.' : 'Enter how much comes in.'); return }
    if (!Number.isInteger(y) || y < thisYear || y > thisYear + 50) { setError(`Pick a year from ${thisYear} on.`); return }
    await change(db => saveOneOff(db, existing?.id ?? null, { name, amt: amount, year: y, kind }))
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
      <Stack.Screen options={{ title: existing ? 'Change a one-off' : 'Add a one-off' }} />
      <Field label="What kind?" hint={oneOffKindOf(kind).hint}>
        <Choice label="What kind" wrap options={ONE_OFF_KINDS.map(k => ({ key: k.key, label: k.label }))} value={kind} onChange={setKind} />
      </Field>
      <Field label="Name">
        <TextField label="Name" value={name} onChange={setName} placeholder={kind === 'cost' ? 'e.g. New car' : kind === 'borrow' ? 'e.g. Home loan top-up' : 'e.g. Inheritance'} />
      </Field>
      <Field label="How much?" hint={kind === 'cost' ? 'What you expect to pay at the time.' : 'What you’d have in hand.'}>
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
