// Future → Next 2 years: cash in the bank month by month, with pay following
// the plan's work changes and parental leave, and yearly bills landing in their month. The same
// figures as the NAS's "Next 2 years" page (@proviso/core/cashflow).

import { View } from 'react-native'
import { Stack } from 'expo-router'
import { fmt, fmtK } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { cashflowView } from '@/data/views'
import { Card, H2, Screen, T } from '@/ui/kit'
import { NetWorthBars } from '@/ui/NetWorthBars'
import { usePalette, space } from '@/ui/theme'

export default function CashflowScreen() {
  const { household } = useHousehold()
  const p = usePalette()
  const v = cashflowView(household, new Date())
  const last = v.months[v.months.length - 1]

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Next 2 years' }} />

      <Card tone={v.runsOut ? 'bad' : 'good'}>
        {v.runsOut ? (
          <>
            <T size="small" tone="t2">Cash in the bank</T>
            <T size="title" weight="700" tone="red">Runs out in {v.runsOut.label}</T>
          </>
        ) : (
          <>
            <T size="small" tone="t2">Cash in the bank in two years</T>
            <T size="hero" weight="700">{fmtK(last.balance)}</T>
            <T tone="t2">
              {v.lowest === v.months[0]
                ? `Up from ${fmt(v.months[0].balance)} next month.`
                : `It dips to ${fmt(v.lowest.balance)} in ${v.lowest.label}${v.lowest.bills.length ? `, when ${v.lowest.bills.map(b => b.name.toLowerCase()).join(' and ')} ${v.lowest.bills.length > 1 ? 'are' : 'is'} due` : ''}.`}
            </T>
          </>
        )}
        <NetWorthBars labels={v.months.map(m => m.label)} values={v.months.map(m => m.balance)} what="Cash in the bank" />
        <T size="small" tone="t2">
          Now {fmt(v.monthlyIn)} comes in each month and {fmt(v.monthlyOut)} goes on regular spending; yearly bills land in the month they’re due.
          It starts from the {fmt(v.cashOnHand)} you have now. Pay follows your plan’s work changes; prices stay as they are.
        </T>
      </Card>

      {v.payChanges.length > 0 && (
        <View style={{ gap: space.sm }}>
          <H2>Changes to pay</H2>
          <Card>
            {v.payChanges.map(c => (
              <Row key={c.label} label={`From ${c.label}${c.onLeave ? `, ${v.person2Name} on parental leave` : ''}`} value={`${fmt(c.income)} a month`} good />
            ))}
            <T size="small" tone="t2">From the work changes and parental leave in your plan (What if? → Work). Parental Leave Pay is after tax.</T>
          </Card>
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <H2>Month by month</H2>
        <Card style={{ gap: 0, paddingVertical: space.sm }}>
          {v.months.map((m, i) => (
            <View key={m.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: p.border }}>
              <T weight="600" style={{ width: 64 }}>{m.label}</T>
              <View style={{ flex: 1 }}>
                {m.bills.map(b => <T key={b.name} size="small" tone="t2">{b.name} {fmt(b.amt)}</T>)}
              </View>
              <T weight="600" tone={m.balance < 0 ? 'red' : 't1'}>{fmt(m.balance)}</T>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  )
}

function Row({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <T style={{ flex: 1 }}>{label}</T>
      <T weight="600" tone={good ? 'green' : 'red'}>{value}</T>
    </View>
  )
}
