// Changing what comes in: each person's pay and the days they work this year.
// Take-home pay is worked out from the salary (same tax and HELP rules as the
// NAS); households that record take-home pay directly edit that instead.

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { calcAfterTax } from '@proviso/core/tax'
import { workDaysForYear } from '@proviso/core/projections'
import { fmt } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { savePay } from '@/data/setup'
import { Button, Card, Choice, Field, NumberField, Sheet, T, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'
import { TYPICAL } from '@proviso/core/starter'

const DAYS = [{ key: '0', label: 'Not working' }, ...[1, 2, 3, 4, 5].map(d => ({ key: String(d), label: String(d) }))]
const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]

interface PayForm { amount: string; days: string; hasHelp: boolean }

export default function Income() {
  const { household: h, change } = useHousehold()
  const year = new Date().getFullYear()
  const taxMode = h.income.taxMode
  const people = [
    { key: 'p1' as const, name: h.settings.person1Name, n: 1 as const },
    ...(h.settings.partnerEnabled ? [{ key: 'p2' as const, name: h.settings.person2Name, n: 2 as const }] : []),
  ]
  const initial = (key: 'p1' | 'p2', n: 1 | 2): PayForm => {
    const amount = taxMode ? h.income[`person${n}FTE`] : h.income[`person${n}MonthlyNet`]
    return {
      amount: amount > 0 ? String(amount) : '',
      days: String(workDaysForYear(h.workPhases.filter(w => w.person === key), year)),
      hasHelp: h.income[`person${n}HasHELP`],
    }
  }
  const [forms, setForms] = useState(() => Object.fromEntries(people.map(x => [x.key, initial(x.key, x.n)])) as Record<'p1' | 'p2', PayForm>)
  const [error, setError] = useState<string | null>(null)

  const patch = (k: 'p1' | 'p2', x: Partial<PayForm>) => setForms(f => ({ ...f, [k]: { ...f[k], ...x } }))
  const amountOf = (f: PayForm) => { const n = parseAmount(f.amount); return Number.isFinite(n) && n >= 0 ? n : NaN }

  async function save() {
    if (people.some(x => Number.isNaN(amountOf(forms[x.key])) && forms[x.key].amount.trim() !== '')) { setError('Check the amounts: numbers only.'); return }
    await change(async db => {
      for (const x of people) {
        const f = forms[x.key]
        await savePay(db, x.key, { amount: amountOf(f) || 0, days: Number(f.days), hasHelp: f.hasHelp, taxMode }, h.workPhases, year)
      }
    })
    router.back()
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: 'Pay' }} />
      {people.map(x => {
        const f = forms[x.key]
        const gross = (amountOf(f) || 0) * Number(f.days) / 5
        return (
          <Card key={x.key} style={{ gap: space.lg }}>
            <T size="title" weight="700">{x.name}</T>
            <Field label="Days a week working">
              <Choice wrap label={`${x.name}, days a week working`} options={DAYS} value={f.days} onChange={v => patch(x.key, { days: v })} />
            </Field>
            {taxMode ? (
              <>
                <Field label="Full-time salary" hint="Before tax, not counting super. If part-time, the full-time figure: it’s scaled by the days worked.">
                  <NumberField label={`${x.name}, full-time salary`} value={f.amount} onChange={v => patch(x.key, { amount: v })} typical={TYPICAL.salary} typicalNote="median full-time pay" />
                </Field>
                <Field label="HELP or HECS student debt?">
                  <Choice label={`${x.name}, HELP debt`} options={YES_NO} value={f.hasHelp ? 'yes' : 'no'} onChange={k => patch(x.key, { hasHelp: k === 'yes' })} />
                </Field>
                {gross > 0 && <T tone="t2">About {fmt(calcAfterTax(gross, f.hasHelp) / 12)} a month after tax{f.hasHelp ? ' and HELP repayments' : ''}.</T>}
              </>
            ) : (
              <Field label="Take-home pay each month" hint="After tax, as it lands in the bank.">
                <NumberField label={`${x.name}, take-home pay each month`} value={f.amount} onChange={v => patch(x.key, { amount: v })} />
              </Field>
            )}
          </Card>
        )
      })}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
      </View>
    </Sheet>
  )
}
