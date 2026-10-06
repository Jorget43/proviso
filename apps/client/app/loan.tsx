// The home loan: what's owing, the rate, and the repayment. The repayment
// suggested is the one that clears the loan in the years left (same sum as
// the NAS); the budget's Mortgage line follows whatever is saved.

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { computeMonthlyRepayment, monthsToRepay, monthsUntil } from '@proviso/core/mortgage'
import { TYPICAL } from '@proviso/core/starter'
import { fmt } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { saveLoan } from '@/data/wealth'
import { Button, Field, NumberField, Sheet, T, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

export default function Loan() {
  const { household, change } = useHousehold()
  const m = household.mortgage
  const now = new Date()
  const yearsLeft = m?.endDate ? Math.round(monthsUntil(m.endDate, now) / 12) : 0

  const [balance, setBalance] = useState(m && m.balance > 0 ? String(m.balance) : '')
  const [rate, setRate] = useState(m && m.balance > 0 ? String(m.rate) : '')
  const [years, setYears] = useState(yearsLeft > 0 ? String(yearsLeft) : '')
  const [payment, setPayment] = useState(m && m.payment > 0 ? String(m.payment) : '')
  const [error, setError] = useState<string | null>(null)

  const n = (s: string) => { const x = parseAmount(s); return Number.isFinite(x) ? x : NaN }
  const suggested = computeMonthlyRepayment(n(balance) || 0, n(rate) || 0, (n(years) || 0) * 12)

  async function save() {
    if (!(n(balance) >= 0) || !(n(rate) >= 0) || !(n(years) > 0)) { setError('Fill in what’s owing, the rate and the years left.'); return }
    const pay = Number.isFinite(n(payment)) && n(payment) > 0 ? n(payment) : suggested
    // The finish date is the one this repayment actually reaches.
    const months = monthsToRepay(n(balance), n(rate), pay)
    if (months === null) { setError('That repayment doesn’t cover the interest, so the loan would never be paid off.'); return }
    const end = new Date(now.getFullYear(), now.getMonth() + months, 1)
    const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`
    await change(db => saveLoan(db, { balance: n(balance), rate: n(rate), payment: pay, endDate }))
    router.back()
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: 'Home loan' }} />
      <Field label="Still owing">
        <NumberField label="Still owing" value={balance} onChange={setBalance} />
      </Field>
      <Field label="Interest rate">
        <NumberField unit="%" label="Interest rate" value={rate} onChange={setRate} typical={TYPICAL.mortgageRate} typicalNote="average variable rate" />
      </Field>
      <Field label="Years left to pay">
        <NumberField unit="years" label="Years left" value={years} onChange={setYears} />
      </Field>
      <Field label="Monthly repayment" hint="What you actually pay. Leave it empty to use the repayment that clears the loan on time.">
        <NumberField label="Monthly repayment" value={payment} onChange={setPayment} typical={suggested > 0 ? suggested : undefined} typicalNote="clears it on time" />
      </Field>
      {suggested > 0 && n(payment) > suggested && (() => {
        const months = monthsToRepay(n(balance), n(rate), n(payment))
        const early = months === null ? 0 : (n(years) || 0) * 12 - months
        return <T tone="green">Paying {fmt(n(payment) - suggested)} a month extra{early >= 12 ? ` finishes about ${Math.floor(early / 12)} year${early >= 24 ? 's' : ''} early` : ' finishes early'}.</T>
      })()}
      <T size="small" tone="t2">Saving also updates the Mortgage line in Spending.</T>
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
      </View>
    </Sheet>
  )
}
