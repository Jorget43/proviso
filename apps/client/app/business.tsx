// Business income: profit from a business, sole trading or gig work
// (core/businessIncome.ts). Lists each one, with what they add to take-home
// pay this year; each opens app/businessitem.tsx.

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
  const items = h.incomeSources.filter(i => i.kind === 'business' && (h.settings.partnerEnabled || i.person === 'p1'))

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Business income' }} />
      <Card>
        <T tone="t2">
          Profit from a business, sole trading or gig work: what’s left after its own costs, before income tax. It’s taxed
          on top of pay, and counts towards HELP repayments. Leave its costs out of Spending.
        </T>
        <T size="small" tone="t2">No super is paid on it for you. Putting some into super yourself can make up for that.</T>
        {adds > 0 && <T weight="600">This year it adds about {fmt(adds)} a month after tax.</T>}
      </Card>
      {items.length > 0 && (
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          {items.map((i, k) => (
            <Pressable key={i.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/businessitem', params: { id: i.id } })}
              style={({ pressed }) => ({ minHeight: touch, paddingVertical: space.sm, borderTopWidth: k === 0 ? 0 : 1, borderTopColor: p.border, opacity: pressed ? 0.6 : 1 })}>
              <T weight="600">{i.name || 'Business'}{h.settings.partnerEnabled ? ` · ${name(i.person)}` : ''}</T>
              <T size="small" tone="t2">
                {fmt(i.amount)} a year profit, {i.startYear}{i.endYear !== null ? `–${i.endYear}` : ' until work stops'}
              </T>
            </Pressable>
          ))}
        </Card>
      )}
      <View style={{ gap: space.sm }}>
        <Button kind="quiet" title="Add business income" onPress={() => router.push('/businessitem')} />
      </View>
    </Screen>
  )
}
