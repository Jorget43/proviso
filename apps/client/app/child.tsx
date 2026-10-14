// Add or change a child (?id= to change). Their birth year sets when school
// fees start and stop in the projection.

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { childAge, childLabel } from '@proviso/core/people'
import { useHousehold } from '@/data/DataProvider'
import { saveChild, removeChild } from '@/data/settings'
import { Button, Choice, Field, NumberField, Sheet, T, TextField, parseAmount } from '@/ui/kit'
import { confirmAction } from '@/ui/confirm'
import { space } from '@/ui/theme'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_OPTIONS = [{ key: '', label: 'Not sure' }, ...MONTHS.map((m, i) => ({ key: String(i + 1), label: m }))]

export default function Child() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { household: h, change } = useHousehold()
  const index = params.id ? h.children.findIndex(c => c.id === params.id) : -1
  const existing = index >= 0 ? h.children[index] : undefined
  const label = existing ? childLabel(existing, index + 1) : null

  const [name, setName] = useState(existing?.name ?? '')
  const [year, setYear] = useState(existing ? String(existing.birthYear) : '')
  const [month, setMonth] = useState(existing?.birthMonth ? String(existing.birthMonth) : '')
  const [error, setError] = useState<string | null>(null)

  const y = parseAmount(year)
  const age = Number.isInteger(y) ? childAge({ name: null, birthYear: y, birthMonth: month ? Number(month) : null }, new Date()) : null

  async function save() {
    let problem: string | null = null
    await change(async db => { problem = await saveChild(db, existing?.id ?? null, { name, birthYear: y, birthMonth: month ? Number(month) : null }) })
    if (problem) { setError(problem); return }
    router.back()
  }

  function remove() {
    if (!existing) return
    confirmAction(`Remove ${label}?`, 'Their school fees stop counting in the projection.', 'Remove', async () => {
      await change(db => removeChild(db, existing.id))
      router.back()
    })
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: existing ? `Change ${label}` : 'Add a child' }} />
      <Field label="Name" hint="Optional. Without one, they’re called Child 1, Child 2… eldest first.">
        <TextField label="Name" value={name} onChange={setName} />
      </Field>
      <Field label="Year they were born" hint="For a child on the way or one you’re planning, the year you expect them. Their costs start then.">
        <NumberField unit="" label="Year they were born" value={year} onChange={setYear} />
      </Field>
      <Field label="Month (optional)">
        <Choice label="Month born" wrap options={MONTH_OPTIONS} value={month} onChange={setMonth} />
      </Field>
      {age !== null && year.length === 4 && <T size="small" tone="t2">{age === 0 ? 'Under 1 now.' : `${age} now.`} They start Prep the year they turn 5; school fees stop after Year 12.</T>}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
        {existing && <Button kind="danger" title="Remove" onPress={remove} />}
      </View>
    </Sheet>
  )
}
