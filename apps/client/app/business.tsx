// Bonuses and business income (core/businessIncome.ts): a bonus or commission
// from a job, and profit from a business, sole trading or gig work. Lists
// each, with what they add to take-home pay this year; each opens
// app/businessitem.tsx.

import { Pressable, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { fmt } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { homeView } from '@/data/views'
import { Button, Card, Screen, T } from '@/ui/kit'
import { usePalette, space, touch } from '@/ui/theme'

export default function Business() {
  const { household: h } = useHousehold()
  const p = usePalette()
  const adds = homeView(h, new Date()).budget.businessMonthly
  const name = (person: string) => (person === 'p2' ? h.settings.person2Name : h.settings.person1Name)
  const items = h.incomeSources.filter(i => (i.kind === 'business' || i.kind === 'bonus') && (h.settings.partnerEnabled || i.person === 'p1'))

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Bonuses and business income' }} />
      <Card>
        <T tone="t2">
          Money on top of regular pay: a bonus or commission from your job, or profit from a business, sole trading or gig
          work. Both are taxed on top of pay and count towards HELP repayments.
        </T>
        <T size="small" tone="t2">Your employer pays super on a bonus. No super is paid on business profit for you, so consider putting some in yourself.</T>
        {adds > 0 && <T weight="600">This year they add about {fmt(adds)} a month after tax.</T>}
      </Card>
      {items.length > 0 && (
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          {items.map((i, k) => (
            <Pressable key={i.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/businessitem', params: { id: i.id } })}
              style={({ pressed }) => ({ minHeight: touch, paddingVertical: space.sm, borderTopWidth: k === 0 ? 0 : 1, borderTopColor: p.border, opacity: pressed ? 0.6 : 1 })}>
              <T weight="600">{i.name || (i.kind === 'bonus' ? 'Bonus or commission' : 'Business')}{h.settings.partnerEnabled ? ` · ${name(i.person)}` : ''}</T>
              <T size="small" tone="t2">
                {fmt(i.amount)} a year {i.kind === 'bonus' ? 'before tax' : 'profit'}, {i.startYear}{i.endYear !== null ? `–${i.endYear}` : ' until work stops'}
              </T>
            </Pressable>
          ))}
        </Card>
      )}
      <View style={{ gap: space.sm }}>
        <Button kind="quiet" title="Add a bonus or commission" onPress={() => router.push({ pathname: '/businessitem', params: { kind: 'bonus' } })} />
        <Button kind="quiet" title="Add business income" onPress={() => router.push('/businessitem')} />
      </View>
    </Screen>
  )
}
