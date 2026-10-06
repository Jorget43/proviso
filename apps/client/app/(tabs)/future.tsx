// Future: where the household is headed. Net worth year by year, the
// milestones on the way, and retirement. The projection and super engines are
// @proviso/core's, fed by core/future.ts, the same as the NAS's Projections
// and Super pages.

import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { fmt, fmtK } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { futureView } from '@/data/views'
import { Button, Card, H2, Screen, T } from '@/ui/kit'
import { usePalette, space, radius, touch } from '@/ui/theme'

export default function Future() {
  const { household } = useHousehold()
  const p = usePalette()
  const v = futureView(household, new Date())
  const a = v.assumptions

  return (
    <Screen>
      <Card tone={v.endNetWorth >= v.netWorthToday ? 'good' : 'bad'}>
        <T size="small" tone="t2">Net worth in {v.years} years</T>
        <T size="hero" weight="700">{fmtK(v.endNetWorthReal)}</T>
        <T tone="t2">
          In today’s money ({fmtK(v.endNetWorth)} in {v.labels[v.labels.length - 1]} dollars). You’re at {fmtK(v.netWorthToday)} now.
        </T>
        <NetWorthBars labels={v.labels} values={v.netWorth} />
      </Card>

      {v.shortYears.length > 0 && (
        <View style={{ backgroundColor: v.borrowing ? p.redLt : p.amberLt, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
          <T>
            More goes out than comes in during {v.shortYears.length === 1 ? v.shortYears[0]
              : `${v.shortYears.length} of these years (first in ${v.shortYears[0]})`}.
            {v.borrowing
              ? ` Savings and investments run out in ${v.borrowing.from}; after that the gap has to be borrowed${v.borrowing.owedAtEnd > 0 ? `, about ${fmtK(v.borrowing.owedAtEnd)} by the end` : ''}.`
              : ' Savings cover it.'}
          </T>
          <View style={{ alignItems: 'flex-start' }}>
            <Button kind="quiet" title="Review spending" onPress={() => router.push('/spending')} />
          </View>
        </View>
      )}

      {v.milestones.length > 0 && (
        <View style={{ gap: space.sm }}>
          <H2>On the way</H2>
          <Card style={{ gap: 0, paddingVertical: space.sm }}>
            {v.milestones.map((m, i) => (
              <View key={m.text} style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: p.border }}>
                <T weight="700" style={{ width: 48 }}>{m.year}</T>
                <T style={{ flex: 1 }}>{m.text}</T>
              </View>
            ))}
          </Card>
          {v.schoolFees.on && v.schoolFees.total > 0 && (
            <T size="small" tone="t2">School fees come to about {fmtK(v.schoolFees.total)} over these years, rising each year and ending after Year 12.</T>
          )}
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <H2>Retirement</H2>
        <Card>
          {v.retirement.people.map(x => (
            <View key={x.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs }}>
              <View style={{ flex: 1 }}>
                <T>{x.name}</T>
                <T size="caption" tone="t3">super at {x.age}, in {x.year}</T>
              </View>
              <T weight="600">{fmtK(x.balanceToday)}</T>
            </View>
          ))}
          <T tone={v.retirement.runsOutAt === null ? 'green' : 'amber'}>
            {v.retirement.runsOutAt === null
              ? `Enough for ${fmt(v.retirement.goalMonthly)} a month in retirement, past age 100.`
              : `${fmt(v.retirement.goalMonthly)} a month in retirement would run super out around age ${v.retirement.runsOutAt}.`}
          </T>
          <T size="small" tone="t2">In today’s money. Doesn’t count the Age Pension or savings outside super.</T>
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Big one-off costs</H2>
        <Card style={{ gap: 0, paddingVertical: space.sm }}>
          {household.oneOffs.length === 0 && <T tone="t2" style={{ paddingVertical: space.sm }}>A new car, a renovation, a wedding: add them here to see the effect.</T>}
          {[...household.oneOffs].sort((x, y) => x.year - y.year).map((o, i) => (
            <Pressable key={o.id} accessibilityRole="button" accessibilityHint="Change or remove"
              onPress={() => router.push({ pathname: '/oneoff', params: { id: o.id } })}
              style={({ pressed }) => ({ minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm,
                borderTopWidth: i ? 1 : 0, borderTopColor: p.border, opacity: pressed ? 0.6 : 1 })}>
              <T weight="700" style={{ width: 48 }}>{o.year}</T>
              <T style={{ flex: 1 }}>{o.name}</T>
              <T weight="600">{fmt(o.amt)}</T>
            </Pressable>
          ))}
        </Card>
        <View style={{ alignItems: 'flex-start' }}>
          <Button kind="quiet" title="+ Add a one-off cost" onPress={() => router.push('/oneoff')} />
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Assumptions</H2>
        <Card>
          <T tone="t2">
            Pay rises {a.salaryGrowth}% a year, prices {a.inflation}%, investments return {a.investReturn}%,
            homes grow {a.propGrowth}%. {a.savingsRate}% of what’s left over each year is invested.
          </T>
          <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
            <Button kind="quiet" title="Change assumptions" onPress={() => router.push('/assumptions')} />
          </View>
        </Card>
      </View>
    </Screen>
  )
}

/** Net worth each year as bars, labelled at the start, middle and end. Negative years go red. */
function NetWorthBars({ labels, values }: { labels: string[]; values: number[] }) {
  const p = usePalette()
  const max = Math.max(1, ...values.map(Math.abs))
  const H = 96
  return (
    <View accessible accessibilityLabel={`Net worth from ${fmtK(values[0] ?? 0)} in ${labels[0]} to ${fmtK(values[values.length - 1] ?? 0)} in ${labels[labels.length - 1]}`}
      style={{ marginTop: space.md, gap: space.xs }}>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {values.map((v, i) => (
          <View key={labels[i]} style={{ flex: 1, height: Math.max(2, Math.abs(v) / max * H), borderRadius: 2, backgroundColor: v >= 0 ? p.green : p.red, opacity: 0.85 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[...new Set([labels[0], labels[Math.floor((labels.length - 1) / 2)], labels[labels.length - 1]])].map(l => (
          <T key={l} size="caption" tone="t3">{l}</T>
        ))}
      </View>
    </View>
  )
}
