// Childcare: the daily fee, days and children. The cost after the Child Care
// Subsidy is worked out from the household's income (@proviso/core/childcare).

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { computeChildcare, CCS_HOURLY_CAP, CCS_SESSION_HOURS } from '@proviso/core/childcare'
import { fmt } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { saveChildcare } from '@/data/settings'
import { homeView } from '@/data/views'
import { Button, Choice, Field, NumberField, Sheet, T, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]
const DAYS = [1, 2, 3, 4, 5].map(d => ({ key: String(d), label: String(d) }))
const KIDS = [1, 2, 3].map(d => ({ key: String(d), label: String(d) }))

export default function Childcare() {
  const { household: h, change } = useHousehold()
  const c = h.childcare
  const [on, setOn] = useState(c.enabled)
  const [fee, setFee] = useState(String(c.costPerDay))
  const [days, setDays] = useState(String(c.daysPerWeek))
  const [kids, setKids] = useState(String(Math.min(3, Math.max(1, c.numChildren))))
  const [error, setError] = useState<string | null>(null)

  const income = homeView(h, new Date()).budget.familyIncome
  const f = parseAmount(fee)
  const result = Number.isFinite(f) && f > 0
    ? computeChildcare({ costPerDay: f, daysPerWeek: Number(days), numChildren: Number(kids), familyIncome: income })
    : null

  async function save() {
    if (on && !(Number.isFinite(f) && f > 0)) { setError('Enter the daily fee.'); return }
    await change(db => saveChildcare(db, { enabled: on, costPerDay: f || c.costPerDay, daysPerWeek: Number(days), numChildren: Number(kids) }))
    router.back()
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: 'Childcare' }} />
      <Field label="Do you pay for childcare?">
        <Choice label="Childcare" options={YES_NO} value={on ? 'yes' : 'no'} onChange={k => setOn(k === 'yes')} />
      </Field>
      {on && (
        <>
          <Field label="Daily fee, per child" hint="Before the subsidy, as on the centre’s fee list.">
            <NumberField label="Daily fee per child" value={fee} onChange={setFee} />
          </Field>
          <Field label="Days a week">
            <Choice label="Days a week" options={DAYS} value={days} onChange={setDays} />
          </Field>
          <Field label="Children in care">
            <Choice label="Children in care" options={KIDS} value={kids} onChange={setKids} />
          </Field>
          {result && (
            <T tone="t2">
              About {fmt(result.netMonthly)} a month after the Child Care Subsidy ({result.standardRate}%{Number(kids) > 1 && result.higherRate !== result.standardRate ? `, ${result.higherRate}% for younger children` : ''}), on your household income of {fmt(income)}.
              {result.capApplied ? ` Fees above ${fmt(CCS_HOURLY_CAP * CCS_SESSION_HOURS)} a day aren’t subsidised.` : ''}
            </T>
          )}
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
