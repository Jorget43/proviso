// Salary packaging: part of someone's pay going to costs before tax
// (core/packaging.ts). Lists the items, with what packaging adds to
// take-home pay this year; each opens app/packaged.tsx.

import { Pressable, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { fmt, possessive } from '@proviso/core/formatting'
import { PACKAGE_KINDS, PACKAGE_LABELS, type PackageKind } from '@proviso/core/packaging'
import { useHousehold } from '@/data/DataProvider'
import { homeView } from '@/data/views'
import { Button, Card, H2, Screen, T } from '@/ui/kit'
import { usePalette, space, touch } from '@/ui/theme'

export default function Packaging() {
  const { household: h } = useHousehold()
  const p = usePalette()
  const saving = homeView(h, new Date()).budget.packagingMonthly
  const name = (person: string) => possessive(person === 'p2' ? h.settings.person2Name : h.settings.person1Name)
  const items = h.packagedItems.filter(i => h.settings.partnerEnabled || i.person === 'p1')

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Salary packaging' }} />
      <Card>
        <T tone="t2">
          Part of your pay can go to some costs before tax, so less of it is taxed: up to a cap if you work for a charity or a
          public hospital, or the lease and running costs of an electric car. Keep those costs in Spending as they are.
        </T>
        {!h.income.taxMode && <T tone="amber">Packaging needs salaries before tax: you’ve entered take-home pay. Change it under Pay.</T>}
        {saving > 0 && <T weight="600">This year it adds about {fmt(saving)} a month to your take-home pay.</T>}
      </Card>
      {items.length > 0 && (
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          {items.map((i, k) => (
            <Pressable key={i.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/packaged', params: { id: i.id } })}
              style={({ pressed }) => ({ minHeight: touch, paddingVertical: space.sm, borderTopWidth: k === 0 ? 0 : 1, borderTopColor: p.border, opacity: pressed ? 0.6 : 1 })}>
              <T weight="600">{PACKAGE_LABELS[i.kind as PackageKind] ?? 'Packaging (from a newer version)'}</T>
              <T size="small" tone="t2">
                {fmt(i.amount)} a year from {name(i.person)} pay, {i.startYear}{i.endYear !== null ? `–${i.endYear}` : ' on'}
              </T>
            </Pressable>
          ))}
        </Card>
      )}
      <View style={{ gap: space.sm }}>
        <H2>Add</H2>
        {PACKAGE_KINDS.map(k => (
          <Button key={k} kind="quiet" title={PACKAGE_LABELS[k]} onPress={() => router.push({ pathname: '/packaged', params: { kind: k } })} />
        ))}
      </View>
    </Screen>
  )
}
