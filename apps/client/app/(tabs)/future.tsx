// Future: where the household is headed. Net worth year by year, the
// milestones on the way, and retirement. The projection and super engines are
// @proviso/core's, fed by core/future.ts, the same as the NAS's Projections
// and Super pages.

import { useMemo } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { fmt, fmtK } from '@proviso/core/formatting'
import { chanceWords } from '@proviso/core/uncertainty'
import { useHousehold } from '@/data/DataProvider'
import { futureView, cashflowView, compareView, type CompareRow, type FutureView } from '@/data/views'
import { removeScenario, showScenario } from '@/data/whatif'
import { confirmAction } from '@/ui/confirm'
import { Button, Card, H2, Screen, T } from '@/ui/kit'
import { ScrubChart, type ChartSeries } from '@/ui/ScrubChart'
import { usePalette, space, radius, touch } from '@/ui/theme'

export default function Future() {
  const { household, change } = useHousehold()
  const p = usePalette()
  // A few hundred runs for the range: worked out once per change, not per render.
  const v = useMemo(() => futureView(household, new Date()), [household])
  const cf = cashflowView(household, new Date())
  const a = v.assumptions
  const compare = compareView(household, new Date())

  return (
    <Screen>
      <Card tone={v.endNetWorth >= v.netWorthToday ? 'good' : 'bad'}>
        <T size="small" tone="t2">Net worth in {v.years} years</T>
        <T size="hero" weight="700">{fmtK(v.endNetWorthReal)}</T>
        <T tone="t2">
          In today’s money ({fmtK(v.endNetWorth)} in {v.labels[v.labels.length - 1]} dollars). You’re at {fmtK(v.netWorthToday)} now.
        </T>
        {v.range.on && (
          <T tone="t2">In 8 of 10 runs, somewhere between {fmtK(v.range.endLowReal)} and {fmtK(v.range.endHighReal)} in today’s money, depending on how investments do.</T>
        )}
        <View style={{ marginTop: space.md }}>
          <ScrubChart title="Net worth by year" labels={v.labels} series={[
            { key: 'plan', label: compare.length ? 'Your plan' : 'Net worth', data: v.netWorth, color: p.green, area: true,
              band: v.range.on ? { low: v.range.netWorthLow, high: v.range.netWorthHigh } : undefined },
            ...compare.filter(r => r.id !== null && r.shown && r.colour).map((r): ChartSeries => ({
              key: r.id!, label: r.name, data: fit(r.netWorth, v.labels.length), color: p[r.colour!], dashed: true, compareTo: v.netWorth,
            })),
          ]} />
          <T size="caption" tone="t3">In each year’s dollars, without super.{v.range.on ? ` Shaded: the middle 8 in 10 of ${v.range.runs} runs where returns rise and fall from year to year. Estimates, not advice.` : ''}</T>
        </View>
        <T size="small" tone="t2" style={{ marginTop: space.sm }}>Try a pay rise, fewer days at work or buying a home, and see what changes.</T>
        <View style={{ alignItems: 'flex-start' }}>
          <Button title="What if?" onPress={() => router.push('/whatif')} />
        </View>
      </Card>

      {compare.length > 0 && (
        <Compare rows={compare}
          onShow={row => { void change(db => showScenario(db, row.id!, !row.shown)) }}
          onRemove={row => confirmAction(`Delete “${row.name}”?`, 'Your plan isn’t affected.', 'Delete',
            () => { void change(db => removeScenario(db, row.id!)) })} />
      )}

      <Pressable accessibilityRole="button" accessibilityHint="Cash in the bank month by month" onPress={() => router.push('/cashflow')}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: space.xs }}>
              <T weight="600">The next two years</T>
              <T tone={cf.runsOut ? 'red' : 't2'}>
                {cf.runsOut
                  ? `Cash runs out in ${cf.runsOut.label}.`
                  : cf.lowest === cf.months[0]
                    ? `Cash grows to ${fmtK(cf.months[cf.months.length - 1].balance)} in two years.`
                    : `Cash dips to ${fmtK(cf.lowest.balance)} in ${cf.lowest.label}, and is ${fmtK(cf.months[cf.months.length - 1].balance)} in two years.`}
              </T>
            </View>
            <T tone="t3">›</T>
          </View>
        </Card>
      </Pressable>

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
              ? `Enough for ${fmt(v.retirement.goalMonthly)} a month in retirement, to age ${v.retirement.lastAge}.`
              : `${fmt(v.retirement.goalMonthly)} a month in retirement would run your money out around age ${v.retirement.runsOutAt}.`}
          </T>
          {v.range.on && v.range.chanceLasts !== null && (
            <T tone={v.range.chanceLasts >= 0.9 ? 't2' : 'amber'}>
              {`With returns rising and falling, money lasts to age ${v.retirement.lastAge} in ${chanceWords(v.range.chanceLasts)} runs.`}
              {v.range.runsOutLow !== null ? ` In the worst 1 in 10, it runs short around age ${v.range.runsOutLow}.` : ''}
            </T>
          )}
          {v.retirement.bridgeShortYear !== null && (
            <T tone="amber">Savings outside super run out in {v.retirement.bridgeShortYear}, before super can be reached at 60.</T>
          )}
          <T size="small" tone="t2">In today’s money. Counts super and your savings outside it; doesn’t count the Age Pension.</T>
          {v.retirement.superByYear.some(x => x > 0) && (
            <View style={{ marginTop: space.sm }}>
              <ScrubChart title="Super and savings by year" labels={v.labels} height={160}
                defaultIndex={v.retirement.firstRetireYear ? v.labels.indexOf(String(v.retirement.firstRetireYear)) : undefined}
                series={[
                  { key: 'super', label: 'Super', data: v.retirement.superByYear, color: p.teal, area: true,
                    band: v.range.on ? { low: v.range.superLow, high: v.range.superHigh } : undefined },
                  { key: 'outside', label: 'Savings outside super', data: v.retirement.outsideByYear, color: p.blue, dashed: true },
                ]} />
              <T size="caption" tone="t3">In each year’s dollars. Opens at the year you first stop work.</T>
            </View>
          )}
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
            homes grow {a.propGrowth}%. {savingsText(a, v.funTotal)}
          </T>
          <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
            <Button kind="quiet" title="Change assumptions" onPress={() => router.push('/assumptions')} />
          </View>
        </Card>
      </View>
    </Screen>
  )
}

/** The plan and each saved scenario, side by side. */
/** A scenario's values fitted to the plan's years (it may look further ahead, or not as far). */
const fit = (data: number[], length: number): (number | null)[] => Array.from({ length }, (_, i) => data[i] ?? null)

function Compare({ rows, onRemove, onShow }: { rows: CompareRow[]; onRemove: (row: CompareRow) => void; onShow: (row: CompareRow) => void }) {
  const p = usePalette()
  const plan = rows[0]
  return (
    <View style={{ gap: space.sm }}>
      <H2>Compare</H2>
      <Card style={{ gap: 0, paddingVertical: space.sm }}>
        {rows.map((r, i) => {
          const diff = r.endReal - plan.endReal
          const s = r.summary
          return (
            <View key={r.id ?? 'plan'} style={{ gap: space.xs, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: p.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ width: 18, borderTopWidth: 3, borderStyle: r.colour ? 'dashed' : 'solid', borderColor: r.colour ? p[r.colour] : p.green }} />
                <T weight="600" style={{ flex: 1 }}>{r.name}</T>
                <T weight="700">{fmtK(r.endReal)}</T>
              </View>
              {r.id !== null && (
                <T size="small" tone="t2">
                  {s.endYear !== plan.summary.endYear ? `Looks ahead to ${s.endYear}.` : Math.abs(diff) < 500 ? 'Same as your plan.' : `${fmtK(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than your plan.`}
                  {r.changes === 0 ? ' No changes yet.' : ` ${r.changes} change${r.changes === 1 ? '' : 's'}.`}
                </T>
              )}
              <T size="small" tone="t2">
                {s.tightYear ? `Money gets tight in ${s.tightYear}. ` : ''}
                {s.runsOutAge !== null ? `Retirement money runs short at ${s.runsOutAge}. ` : `Retirement money lasts past ${s.lastAge}. `}
                {s.schoolFees > 0 ? `School fees ${fmtK(s.schoolFees)}. ` : ''}
                Lowest cash {fmtK(s.lowestCash.value)} in {s.lowestCash.year}.
              </T>
              {r.id !== null && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  <Button kind="quiet" title={r.shown ? 'Hide from chart' : 'Show on chart'} onPress={() => onShow(r)} />
                  <Button kind="danger" title="Delete" onPress={() => onRemove(r)} />
                </View>
              )}
            </View>
          )
        })}
      </Card>
      <T size="small" tone="t2">Net worth in today’s money, without super. Make another in What if? → Save as a scenario.</T>
    </View>
  )
}

/** What happens to what's left over each year, in one or two sentences. */
function savingsText(a: FutureView['assumptions'], funTotal: number): string {
  const net = a.cashBufferMonths > 0
    ? `You keep ${a.cashBufferMonths} month${a.cashBufferMonths === 1 ? '' : 's'} of spending as a safety net; of what’s left over above it, `
    : 'Of what’s left over each year, '
  const fun = a.funPct > 0 ? `, ${a.funPct}% goes on fun` : ''
  const spent = funTotal > 0 ? ` That’s ${fmtK(funTotal)} on fun along the way.` : ''
  return `${net}${a.savingsRate}% is invested${fun} and the rest stays as cash.${spent}`
}
