// Add or change one business's income (?id= to change).

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { DEFAULT_BUSINESS_GROWTH } from '@proviso/core/businessIncome'
import { useHousehold } from '@/data/DataProvider'
import { saveBusiness, removeBusiness } from '@/data/business'
import { Button, Choice, Field, NumberField, Sheet, T, TextField, parseAmount } from '@/ui/kit'
import { confirmAction } from '@/ui/confirm'
import { space } from '@/ui/theme'

export default function BusinessItem() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { household: h, change } = useHousehold()
  const existing = params.id ? h.incomeSources.find(i => i.id === params.id) : undefined
  const year = new Date().getFullYear()

  const [person, setPerson] = useState<'p1' | 'p2'>(existing?.person ?? 'p1')
  const [label, setLabel] = useState(existing?.name ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [growth, setGrowth] = useState(String(existing?.growthPct ?? DEFAULT_BUSINESS_GROWTH))
  const [from, setFrom] = useState(String(existing?.startYear ?? year))
  const [until, setUntil] = useState(existing?.endYear ? String(existing.endYear) : '')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    let problem: string | null = null
    await change(async db => {
      problem = await saveBusiness(db, existing?.id ?? null, {
        person, name: label, amount: parseAmount(amount), growthPct: parseAmount(growth),
        startYear: parseAmount(from), endYear: until.trim() === '' ? null : parseAmount(until),
      })
    })
    if (problem) { setError(problem); return }
    router.back()
  }

  function remove() {
    if (!existing) return
    confirmAction('Remove this business income?', 'Money in goes back to what it would be without it.', 'Remove', async () => {
      await change(db => removeBusiness(db, existing.id))
      router.back()
    })
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: existing ? 'Business income' : 'Add business income' }} />
      {h.settings.partnerEnabled && (
        <Field label="Whose income">
          <Choice label="Whose income" value={person} onChange={k => setPerson(k as 'p1' | 'p2')}
            options={[{ key: 'p1', label: h.settings.person1Name }, { key: 'p2', label: h.settings.person2Name }]} />
        </Field>
      )}
      <Field label="Name (optional)">
        <TextField label="Name" placeholder="e.g. Photography" value={label} onChange={setLabel} />
      </Field>
      <Field label="Profit a year" hint="What’s left after the business’s own costs, before income tax. A loss counts as nothing.">
        <NumberField label="Profit a year" value={amount} onChange={setAmount} />
      </Field>
      <Field label="Grows each year">
        <NumberField unit="%" label="Profit grows, percent a year" value={growth} onChange={setGrowth} />
      </Field>
      <Field label="From the year">
        <NumberField unit="" label="From the year" value={from} onChange={setFrom} />
      </Field>
      <Field label="Until the year" hint="Leave blank to stop when work stops. A later year keeps it going in retirement.">
        <NumberField unit="" label="Until the year" value={until} onChange={setUntil} />
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
