// Wealth: what you own and owe, the home loan, the cash safety net, super and
// HELP. Figures come from @proviso/core (same as the NAS's Debts & assets
// page); src/data/views.ts arranges them.

import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { fmt, fmtK } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { wealthView, type WealthItem } from '@/data/views'
import { Button, Card, H2, Screen, T } from '@/ui/kit'
import { usePalette, space, radius, touch } from '@/ui/theme'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Wealth() {
  const { household } = useHousehold()
  const p = usePalette()
  const v = wealthView(household, new Date())

  return (
    <Screen>
      <Card tone={v.netWorth >= 0 ? 'good' : 'bad'}>
        <T size="small" tone="t2">Net worth</T>
        <T size="hero" weight="700">{fmtK(v.netWorth)}</T>
        <T tone="t2">{fmt(v.totalOwned)} owned, {fmt(v.totalOwed)} owed. Super is shown separately below.</T>
        {v.netWorthChange && (
          <T size="small" tone={v.netWorthChange.amount > 0 ? 'green' : 'red'}>
            {v.netWorthChange.amount > 0 ? '▲' : '▼'} {fmtK(Math.abs(v.netWorthChange.amount))} since {MONTHS[v.netWorthChange.since.getMonth()]}
          </T>
        )}
      </Card>

      <View style={{ gap: space.sm }}>
        <H2>Safety net</H2>
        <Card>
          <T size="title" weight="700">{fmt(v.cash)}</T>
          <T tone="t2">
            {v.coverMonths === null ? 'In accounts marked as cash.'
              : `In accounts marked as cash: about ${v.coverMonths >= 12 ? '12+' : v.coverMonths.toFixed(1)} months of spending. Three to six months is a common safety net.`}
          </T>
        </Card>
      </View>

      <Section title="What you own" items={v.owned} empty="Nothing listed yet: add savings, shares, your home’s equity or a car."
        add="+ Add something you own" kind="asset" />
      {v.homeMissing && (
        <View style={{ backgroundColor: p.blueLt, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
          <T>Your home isn’t counted yet. Add it as “Home equity”: what it’s worth, less what’s left on the loan.</T>
          <View style={{ alignItems: 'flex-start' }}>
            <Button kind="quiet" title="Add home equity" onPress={() => router.push({ pathname: '/item', params: { kind: 'asset', name: 'Home equity' } })} />
          </View>
        </View>
      )}

      <Section title="What you owe" items={v.owed} empty="No debts listed." add="+ Add a debt" kind="debt" />

      {v.loan ? (
        <View style={{ gap: space.sm }}>
          <H2>Home loan</H2>
          <Card>
            <Row label="Still owing" value={fmt(v.loan.balance)} />
            <Row label="Interest rate" value={`${v.loan.rate}%`} />
            <Row label="Repayment" value={`${fmt(v.loan.payment)} a month`} />
            {v.loan.offset > 0 && <Row label="In the offset" value={fmt(v.loan.offset)} />}
            <T size="small" tone="t2">
              About {fmt(v.loan.monthlyInterest)} of this month’s repayment is interest{v.loan.offset > 0 ? ', after the offset' : ''}.
              {v.loan.endYear ? ` On track to finish in ${v.loan.endYear}.` : ''}
            </T>
            <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
              <Button kind="quiet" title="Change loan" onPress={() => router.push('/loan')} />
            </View>
          </Card>
        </View>
      ) : !household.rent.enabled && (
        <View style={{ alignItems: 'flex-start' }}>
          <Button kind="quiet" title="+ Add a home loan" onPress={() => router.push('/loan')} />
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <H2>Super</H2>
        <Card>
          {v.super.map(s => <Row key={s.person} label={s.name} value={fmt(s.balance)} sub={`retiring at ${s.retirementAge}`} />)}
          <T size="small" tone="t2">Super isn’t in net worth: you can’t spend it until retirement.</T>
          <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
            <Button kind="quiet" title="Update super" onPress={() => router.push('/super')} />
          </View>
        </Card>
      </View>

      {v.help.length > 0 && (
        <View style={{ gap: space.sm }}>
          <H2>HELP debt</H2>
          <Card>
            {v.help.map(x => (
              <Row key={x.person} label={x.name} value={fmt(x.balance)}
                sub={x.yearlyRepayment > 0 ? `about ${fmt(x.yearlyRepayment)} a year comes out of pay` : 'below the repayment threshold this year'} />
            ))}
            <T size="small" tone="t2">Repayments come out through tax, and are already in the take-home pay figures. Change a balance under What you owe.</T>
          </Card>
        </View>
      )}
    </Screen>
  )
}

function Section({ title, items, empty, add, kind }: { title: string; items: WealthItem[]; empty: string; add: string; kind: 'asset' | 'debt' }) {
  const p = usePalette()
  return (
    <View style={{ gap: space.sm }}>
      <H2>{title}</H2>
      <Card style={{ gap: 0, paddingVertical: space.sm }}>
        {items.length === 0 && <T tone="t2" style={{ paddingVertical: space.sm }}>{empty}</T>}
        {items.map((it, i) => (
          <Pressable key={it.id} accessibilityRole="button" accessibilityHint="Change or remove"
            onPress={() => router.push({ pathname: '/item', params: { kind, id: it.id } })}
            style={({ pressed }) => ({
              minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm,
              borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border, opacity: pressed ? 0.6 : 1,
            })}>
            <View style={{ flex: 1 }}>
              <T weight="600">{it.name}</T>
              {it.cash ? <T size="caption" tone="t3">cash{kind === 'asset' ? ' · safety net & offset' : ''}</T> : null}
              {it.home ? <T size="caption" tone="t3">your home, less the loan</T> : null}
            </View>
            <T weight="600">{fmt(it.amt)}</T>
          </Pressable>
        ))}
      </Card>
      <View style={{ alignItems: 'flex-start' }}>
        <Button kind="quiet" title={add} onPress={() => router.push({ pathname: '/item', params: { kind } })} />
      </View>
    </View>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md, paddingVertical: space.xs }}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {sub ? <T size="caption" tone="t3">{sub}</T> : null}
      </View>
      <T weight="600">{value}</T>
    </View>
  )
}
