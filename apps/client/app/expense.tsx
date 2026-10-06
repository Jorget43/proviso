// Add or change a cost. One form for both kinds; the rules for which kind a
// cost is saved as, and moving it between kinds, are in src/data/costs.ts.

import { useState } from 'react'
import { Alert, Platform, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { CATS } from '@proviso/core/constants'
import { toMonthly, fmt } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { saveCost, removeCost, kindOf, type Freq } from '@/data/costs'
import { Button, Choice, Field, Input, Sheet, T, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

const FREQS: { key: Freq; label: string }[] = [
  { key: 'weekly', label: 'Weekly' }, { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' }, { key: 'yearly', label: 'Yearly' },
]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ExpenseSheet() {
  const params = useLocalSearchParams<{ id?: string; kind?: string; cat?: string }>()
  const { household, change } = useHousehold()

  const existing = params.id
    ? (params.kind === 'annual'
      ? household.annualExpenses.find(a => a.id === params.id)
      : household.expenses.find(e => e.id === params.id))
    : undefined
  const wasAnnual = params.kind === 'annual' && existing !== undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [amt, setAmt] = useState(existing ? String(existing.amt) : '')
  const [freq, setFreq] = useState<Freq>(wasAnnual ? 'yearly' : ((existing as { freq?: Freq } | undefined)?.freq ?? 'monthly'))
  const [month, setMonth] = useState<number | null>(wasAnnual ? (existing as { month: number }).month : null)
  const [cat, setCat] = useState<string>(existing?.cat ?? params.cat ?? CATS[0])
  const [error, setError] = useState<string | null>(null)

  const amount = parseAmount(amt)
  const valid = name.trim() !== '' && Number.isFinite(amount) && amount > 0
  const annual = kindOf({ freq, month }) === 'annual'
  const current = existing ? { id: existing.id, kind: wasAnnual ? 'annual' as const : 'regular' as const } : null

  async function save() {
    if (!valid) { setError(name.trim() ? 'Enter how much it costs.' : 'Give it a name.'); return }
    await change(db => saveCost(db, current, { name, cat, amt: amount, freq, month }))
    router.back()
  }

  async function remove() {
    if (!existing) return
    const go = async () => {
      await change(db => removeCost(db, current!))
      router.back()
    }
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`Remove “${existing.name}”?`)) await go(); return }
    Alert.alert(`Remove “${existing.name}”?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: go }])
  }


  return (
    <Sheet>
      <Stack.Screen options={{ title: existing ? 'Change a cost' : 'Add a cost' }} />

      <Field label="What is it?">
        <Input value={name} onChangeText={setName} placeholder="e.g. Groceries" accessibilityLabel="What is it?" />
      </Field>

      <Field label="How much?">
        <Input value={amt} onChangeText={setAmt} keyboardType="decimal-pad" placeholder="0" accessibilityLabel="How much, in dollars" />
      </Field>

      <Field label="How often?">
        <Choice options={FREQS.map(f => ({ key: f.key, label: f.label }))} value={freq} onChange={k => { setFreq(k as Freq); if (k !== 'yearly') setMonth(null) }} />
      </Field>

      {freq === 'yearly' && (
        <Field label="Due in a particular month? (optional)">
          <Choice wrap options={MONTHS.map((m, i) => ({ key: String(i + 1), label: m }))} value={month ? String(month) : ''}
            onChange={k => setMonth(month === Number(k) ? null : Number(k))} />
          <T size="caption" tone="t3">Pick a month for bills like car rego, so Home can remind you before they land.</T>
        </Field>
      )}

      <Field label="Category">
        <Choice wrap options={CATS.map(c => ({ key: c, label: c }))} value={cat} onChange={setCat} />
      </Field>

      {valid && <T tone="t2">That’s about {fmt(annual ? amount / 12 : toMonthly(amount, freq))} a month.</T>}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}

      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
        {existing && <Button kind="danger" title="Remove" onPress={remove} />}
      </View>
    </Sheet>
  )
}
