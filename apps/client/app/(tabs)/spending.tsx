// Spending: what comes in, what goes out, by category. Tap a category to see
// its lines; tap a line to change it.

import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { fmt } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { spendingView, type SpendingLine } from '@/data/views'
import { Button, Card, H2, Screen, ShareBar, T } from '@/ui/kit'
import { usePalette, space, touch } from '@/ui/theme'

const FREQ_WORD: Record<string, string> = { weekly: 'a week', monthly: 'a month', quarterly: 'a quarter', yearly: 'a year' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Spending() {
  const { household } = useHousehold()
  const p = usePalette()
  const v = spendingView(household, new Date())
  const [open, setOpen] = useState<string | null>(null)

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
          <Figure label="In" value={fmt(v.monthlyIncome)} />
          <Figure label="Out" value={fmt(v.monthlyExpenses)} />
          <Figure label={v.left >= 0 ? 'Left over' : 'Short'} value={fmt(Math.abs(v.left))} tone={v.left >= 0 ? 'green' : 'red'} />
        </View>
        <T size="caption" tone="t3">Each month, after tax. Yearly bills are spread across the year.</T>
      </Card>

      <View style={{ gap: space.sm }}>
        <H2>Where it goes</H2>
        {v.categories.length === 0 && (
          <Card><T tone="t2">Nothing here yet. Add your regular costs — rent or mortgage, groceries, bills — to see where your money goes.</T></Card>
        )}
        {v.categories.map(c => {
          const isOpen = open === c.cat
          return (
            <Card key={c.cat} style={{ gap: 0, padding: 0 }}>
              <Pressable
                accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`${c.cat}, ${fmt(c.monthly)} a month, ${c.lines.length} items`}
                onPress={() => setOpen(isOpen ? null : c.cat)}
                style={{ padding: space.lg, gap: space.sm, minHeight: touch }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
                  <T weight="600" style={{ flex: 1 }}>{c.cat}</T>
                  <T tone="t3" size="small">{c.lines.length}</T>
                  <T weight="600">{fmt(c.monthly)}/mo</T>
                  <T tone="t3">{isOpen ? '▴' : '▾'}</T>
                </View>
                <ShareBar share={c.share} color={c.color} />
              </Pressable>
              {isOpen && (
                <View style={{ borderTopWidth: 1, borderTopColor: p.border }}>
                  {c.lines.map(l => <Line key={`${l.kind}-${l.id}`} line={l} />)}
                  <View style={{ padding: space.md, alignItems: 'flex-start' }}>
                    <Button kind="quiet" title={`+ Add to ${c.cat}`} onPress={() => router.push({ pathname: '/expense', params: { cat: c.cat } })} />
                  </View>
                </View>
              )}
            </Card>
          )
        })}
      </View>

      <Button title="+ Add a cost" onPress={() => router.push('/expense')} />
    </Screen>
  )
}

function Figure({ label, value, tone = 't1' }: { label: string; value: string; tone?: 't1' | 'green' | 'red' }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T size="small" tone="t2">{label}</T>
      <T size="title" weight="700" tone={tone} numberOfLines={1}>{value}</T>
    </View>
  )
}

function Line({ line: l }: { line: SpendingLine }) {
  const p = usePalette()
  const how = l.kind === 'annual' ? `once a year, in ${MONTHS[(l.month ?? 1) - 1]}`
    : l.kind === 'rent' ? 'rent — change it in Your situation'
    : l.kind === 'childcare' ? 'after the childcare subsidy'
    : l.freq === 'monthly' ? 'every month'
    : `${fmt(l.amt)} ${FREQ_WORD[l.freq] ?? ''}`
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: touch }}>
      <View style={{ flex: 1 }}>
        <T>{l.name}</T>
        <T size="caption" tone="t3">{how}</T>
      </View>
      <T weight="600">{fmt(l.monthly)}/mo</T>
    </View>
  )
  // Rent and childcare are worked out from their own settings; tapping opens those.
  const open = l.kind === 'rent' ? () => router.push('/rent')
    : l.kind === 'childcare' ? () => router.push('/childcare')
    : () => router.push({ pathname: '/expense', params: { id: l.id, kind: l.kind } })
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${l.name}, ${fmt(l.monthly)} a month. Change`}
      onPress={open}
      style={({ pressed }) => ({ borderBottomWidth: 1, borderBottomColor: p.border, backgroundColor: pressed ? p.surface2 : 'transparent' })}
    >
      {body}
    </Pressable>
  )
}
