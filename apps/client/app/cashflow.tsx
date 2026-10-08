// Future → Next 2 years: cash in the bank month by month if pay and spending
// stay as they are, with yearly bills landing in their month. The same
// figures as the NAS's "Next 2 years" page (@proviso/core/cashflow).

import { View } from 'react-native'
import { Stack } from 'expo-router'
import { fmt, fmtK, fmtS } from '@proviso/core/formatting'
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
          Each month {fmt(v.monthlyIn)} comes in and {fmt(v.monthlyOut)} goes on regular spending; yearly bills land in the month they’re due.
          It starts from the {fmt(v.cashOnHand)} you have now and assumes pay and prices stay as they are.
        </T>
      </Card>

      {v.leave && (
        <View style={{ gap: space.sm }}>
          <H2>If {v.person2Name} takes parental leave</H2>
          <Card>
            <Row label="While Parental Leave Pay lasts (6 months)" value={`${fmtS(v.leave.onPplSurplus)} a month`} good={v.leave.onPplSurplus >= 0} />
            <Row label={`After that, on ${v.person1Name}’s pay only`} value={`${fmtS(v.leave.afterPplSurplus)} a month`} good={v.leave.afterPplSurplus >= 0} />
            <T tone={v.leave.runsOut ? 'red' : 't2'}>
              {v.leave.runsOut
                ? `Cash would run out in ${v.leave.runsOut.label}.`
                : v.leave.runwayMonths === Infinity
                  ? `${v.person1Name}’s pay covers regular spending on its own.`
                  : `On one income, today’s cash would last about ${Math.floor(v.leave.runwayMonths)} months.`}
            </T>
            <NetWorthBars labels={v.months.map(m => m.label)} values={v.months.map(m => m.leaveBalance ?? 0)} height={64} what="Cash with parental leave" />
            <T size="small" tone="t2">Parental Leave Pay is the government payment, after tax, starting next month.</T>
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
