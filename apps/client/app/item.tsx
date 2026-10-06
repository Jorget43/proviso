// Add or change something you own or owe. ?kind=asset|debt, ?id= to change,
// ?name= to start a new one with a name (e.g. "Home equity").

import { useState } from 'react'
import { Alert, Platform, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useHousehold } from '@/data/DataProvider'
import { saveAsset, removeAsset, saveDebt, removeDebt } from '@/data/wealth'
import { Button, Choice, Field, NumberField, Sheet, T, TextField, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]

export default function Item() {
  const params = useLocalSearchParams<{ kind?: string; id?: string; name?: string }>()
  const { household, change } = useHousehold()
  const asset = params.kind !== 'debt'
  const existing = params.id
    ? (asset ? household.assets : household.debts).find(x => x.id === params.id)
    : undefined

  const [name, setName] = useState(existing?.name ?? params.name ?? '')
  const [amt, setAmt] = useState(existing ? String(existing.amt) : '')
  const [cash, setCash] = useState(asset && household.assets.find(x => x.id === params.id)?.isOffset === true)
  const [error, setError] = useState<string | null>(null)

  const amount = parseAmount(amt)
  const loan = household.mortgage && household.mortgage.balance > 0 && !household.rent.enabled

  async function save() {
    if (!name.trim()) { setError('Give it a name.'); return }
    if (!Number.isFinite(amount) || amount < 0) { setError('Enter an amount.'); return }
    await change(db => asset
      ? saveAsset(db, existing?.id ?? null, { name, amt: amount, isOffset: cash })
      : saveDebt(db, existing?.id ?? null, { name, amt: amount }))
    router.back()
  }

  async function remove() {
    if (!existing) return
    const go = async () => {
      await change(db => (asset ? removeAsset(db, existing.id) : removeDebt(db, existing.id)))
      router.back()
    }
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`Remove “${existing.name}”?`)) await go(); return }
    Alert.alert(`Remove “${existing.name}”?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: go }])
  }

  const title = existing ? `Change ${asset ? 'what you own' : 'a debt'}` : asset ? 'Add something you own' : 'Add a debt'
  return (
    <Sheet>
      <Stack.Screen options={{ title }} />
      <Field label="Name">
        <TextField label="Name" value={name} onChange={setName} placeholder={asset ? 'e.g. Savings account' : 'e.g. Car loan'} />
      </Field>
      <Field label={asset ? 'What it’s worth' : 'Still owing'}>
        <NumberField label={asset ? 'What it’s worth' : 'Still owing'} value={amt} onChange={setAmt} />
      </Field>
      {asset && (
        <Field label="Is this cash you could use?" hint={`Bank and savings accounts: they count towards your safety net${loan ? ', and together they’re the offset against your home loan' : ''}.`}>
          <Choice label="Cash" options={YES_NO} value={cash ? 'yes' : 'no'} onChange={k => setCash(k === 'yes')} />
        </Field>
      )}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
        {existing && <Button kind="danger" title="Remove" onPress={remove} />}
      </View>
    </Sheet>
  )
}
