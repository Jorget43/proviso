// Home: "are we okay?" Same figures and prompts as the NAS web Home — both
// come from computeHomeOverview in @proviso/core.

import { View } from 'react-native'
import { router } from 'expo-router'
import { fmt, fmtK } from '@proviso/core/formatting'
import type { OverviewTarget } from '@proviso/core/overview'
import { useHousehold } from '@/data/DataProvider'
import { homeView } from '@/data/views'
import { Card, H2, Screen, T, Button } from '@/ui/kit'
import { usePalette, space, radius } from '@/ui/theme'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Where Home's prompts lead in the app. Savings and tax time arrive with the Wealth and EOFY screens.
const TARGET: Record<OverviewTarget, '/income' | '/spending' | '/wealth'> = { income: '/income', budget: '/spending', savings: '/wealth', eofy: '/wealth' }

export default function Home() {
  const { household } = useHousehold()
  const p = usePalette()
  const v = homeView(household, new Date())
  const firstName = v.person1Name.trim().split(/\s+/)[0]

  return (
    <Screen>
      <T size="title" tone="t2">Hi {firstName}</T>

      {!household.settings.onboardingDone && (
        <Card>
          <T weight="600">Finish setting up</T>
          <T tone="t2">Answer a few questions and we’ll fill in typical costs for a household like yours, ready to adjust.</T>
          <View style={{ alignItems: 'flex-start', marginTop: space.sm }}>
            <Button title="Set up my household" onPress={() => router.push('/setup')} />
          </View>
        </Card>
      )}

      <Card tone={v.noIncome ? undefined : v.left >= 0 ? 'good' : 'bad'}>
        <T size="small" tone="t2">Each month</T>
        {v.noIncome ? (
          <T size="hero" weight="700">Let’s get started</T>
        ) : (
          <>
            <T size="hero" weight="700" tone={v.left >= 0 ? 'green' : 'red'}>
              {fmt(Math.abs(v.left))} {v.left >= 0 ? 'left over' : 'short'}
            </T>
            <T tone="t2">
              {fmt(v.budget.monthlyIncome)} comes in after tax, {fmt(v.budget.monthlyExpenses)} goes out (yearly bills spread across the year).
            </T>
          </>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          <Button kind="quiet" title="See spending" onPress={() => router.push('/spending')} />
          <Button kind="quiet" title="Change pay" onPress={() => router.push('/income')} />
        </View>
      </Card>

      {v.checks.length > 0 && (
        <View style={{ gap: space.sm }}>
          <H2>Worth a look</H2>
          {v.checks.map(c => {
            const bg = c.tone === 'red' ? p.redLt : c.tone === 'amber' ? p.amberLt : p.blueLt
            return (
              <View key={c.text} style={{ backgroundColor: bg, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
                <T>{c.text}</T>
                <View style={{ alignItems: 'flex-start' }}>
                  <Button kind="quiet" title={c.cta} onPress={() => router.push(TARGET[c.target])} />
                </View>
              </View>
            )
          })}
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <H2>Where you stand</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Stat label="Net worth" value={fmtK(v.netWorth)}
            sub={v.netWorthChange
              ? `${v.netWorthChange.amount > 0 ? '▲' : '▼'} ${fmtK(Math.abs(v.netWorthChange.amount))} since ${MONTHS[v.netWorthChange.since.getMonth()]}`
              : 'what you own minus what you owe'}
            subTone={v.netWorthChange ? (v.netWorthChange.amount > 0 ? 'green' : 'red') : 't3'} />
          <Stat label="Cash safety net" value={fmtK(v.cash)}
            sub={v.coverMonths !== null ? `about ${v.coverMonths >= 12 ? '12+' : v.coverMonths.toFixed(1)} months of spending` : undefined} />
          {v.mortgageLeft !== null && (
            <Stat label="Home loan left" value={fmtK(v.mortgageLeft)} sub={v.mortgageEndYear ? `on track to finish in ${v.mortgageEndYear}` : undefined} />
          )}
          {v.superTotal > 0 && <Stat label="Super" value={fmtK(v.superTotal)} sub="for retirement" />}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Coming up</H2>
        <Card>
          {v.upcoming.length ? v.upcoming.map(a => (
            <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs }}>
              <View style={{ flex: 1 }}>
                <T weight="600">{a.name}</T>
                <T size="small" tone="t3">{a.monthsAway === 0 ? 'this month' : `in ${MONTHS[a.month - 1]}`}</T>
              </View>
              <T weight="600">{fmt(a.amt)}</T>
            </View>
          )) : (
            <T tone="t2">No yearly bills due in the next three months. Add things like car rego or insurance in Spending so they never catch you out.</T>
          )}
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Your situation</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {v.situation.map(l => (
            <View key={l} style={{ backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs }}>
              <T size="small">{l}</T>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  )
}

function Stat({ label, value, sub, subTone = 't3' }: { label: string; value: string; sub?: string; subTone?: 't3' | 'green' | 'red' }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: 150, gap: space.xs }}>
      <T size="small" tone="t2">{label}</T>
      <T size="title" weight="700">{value}</T>
      {sub ? <T size="caption" tone={subTone}>{sub}</T> : null}
    </Card>
  )
}
