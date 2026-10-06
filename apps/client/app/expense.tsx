// Add or change a cost. One form for both kinds; the rules for which kind a
// cost is saved as, and moving it between kinds, are in src/data/costs.ts.

import { useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, TextInput, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { CATS } from '@proviso/core/constants'
import { toMonthly, fmt } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { saveCost, removeCost, kindOf, type Freq } from '@/data/costs'
import { Button, T } from '@/ui/kit'
import { usePalette, space, radius, font, touch } from '@/ui/theme'

const FREQS: { key: Freq; label: string }[] = [
  { key: 'weekly', label: 'Weekly' }, { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' }, { key: 'yearly', label: 'Yearly' },
]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ExpenseSheet() {
  const params = useLocalSearchParams<{ id?: string; kind?: string; cat?: string }>()
  const { household, change } = useHousehold()
  const p = usePalette()

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

  const amount = Number(amt.replace(/[$,\s]/g, ''))
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

  const input = { minHeight: touch, borderWidth: 1, borderColor: p.borderMd, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: font.body, color: p.t1, backgroundColor: p.surface }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? 'Change a cost' : 'Add a cost' }} />

      <Field label="What is it?">
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Groceries" placeholderTextColor={p.t3} style={input} accessibilityLabel="What is it?" />
      </Field>

      <Field label="How much?">
        <TextInput value={amt} onChangeText={setAmt} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={p.t3} style={input} accessibilityLabel="How much, in dollars" />
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
    </ScrollView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ gap: space.sm }}><T weight="600">{label}</T>{children}</View>
}

function Choice({ options, value, onChange, wrap }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void; wrap?: boolean }) {
  const p = usePalette()
  return (
    <View style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: space.xs }} accessibilityRole="radiogroup">
      {options.map(o => {
        const on = o.key === value
        return (
          <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.key)}
            style={{ minHeight: touch, flexGrow: wrap ? 0 : 1, paddingHorizontal: space.md, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
              backgroundColor: on ? p.t1 : p.surface, borderWidth: 1, borderColor: on ? p.t1 : p.borderMd }}>
            <T size="small" weight="600" style={{ color: on ? p.bg : p.t1 }}>{o.label}</T>
          </Pressable>
        )
      })}
    </View>
  )
}
