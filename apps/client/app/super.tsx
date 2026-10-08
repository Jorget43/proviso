// Super balances and retirement ages, per person.

import { possessive } from '@proviso/core/formatting'
import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useHousehold } from '@/data/DataProvider'
import { saveSuper } from '@/data/wealth'
import { Button, Card, Field, NumberField, Sheet, T, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

export default function Super() {
  const { household: h, change } = useHousehold()
  const people = [
    { n: 1 as const, name: h.settings.person1Name },
    ...(h.settings.partnerEnabled ? [{ n: 2 as const, name: h.settings.person2Name }] : []),
  ]
  const [form, setForm] = useState(() => Object.fromEntries(people.map(x => [x.n, {
    balance: String(h.superSettings[`person${x.n}Balance`] || ''),
    age: String(h.superSettings[`person${x.n}RetirementAge`]),
  }])) as Record<1 | 2, { balance: string; age: string }>)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const patch: Record<string, number> = {}
    for (const x of people) {
      const bal = form[x.n].balance.trim() === '' ? 0 : parseAmount(form[x.n].balance)
      const age = parseAmount(form[x.n].age)
      if (!Number.isFinite(bal) || bal < 0 || !Number.isInteger(age) || age < 50 || age > 80) {
        setError(`Check ${possessive(x.name)} figures: a balance, and a retirement age between 50 and 80.`); return
      }
      patch[`person${x.n}Balance`] = bal
      patch[`person${x.n}RetirementAge`] = age
    }
    await change(db => saveSuper(db, patch))
    router.back()
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: 'Super' }} />
      {people.map(x => (
        <Card key={x.n} style={{ gap: space.lg }}>
          <T size="title" weight="700">{x.name}</T>
          <Field label="Balance" hint="From the super fund’s app or latest statement.">
            <NumberField label={`${x.name}, super balance`} value={form[x.n].balance} onChange={v => setForm(f => ({ ...f, [x.n]: { ...f[x.n], balance: v } }))} />
          </Field>
          <Field label="Retiring at">
            <NumberField unit="" label={`${x.name}, retirement age`} value={form[x.n].age} onChange={v => setForm(f => ({ ...f, [x.n]: { ...f[x.n], age: v } }))} />
          </Field>
        </Card>
      ))}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
      </View>
    </Sheet>
  )
}
