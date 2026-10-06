// The four destinations, as a bottom tab bar (the proviso-ui skill: Home,
// Spending, Wealth, Future — no fifth without asking).

import { Redirect, Tabs, router } from 'expo-router'
import { Pressable } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useHousehold } from '@/data/DataProvider'
import { usePalette } from '@/ui/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']
const icon = (name: IconName) => ({ color }: { color: ColorValue }) => <Ionicons name={name} color={color as string} size={24} />

// The library's bar is 49px with a 28px icon box, leaving the label ~11px —
// enough for native text, but browsers clip it. 58px gives the label a full
// line. A custom height replaces the library's own sum, so the bottom inset
// (home indicator) is added here; the library still pads by it.
const TAB_BAR = 58

export default function TabsLayout() {
  const { household } = useHousehold()
  const p = usePalette()
  const insets = useSafeAreaInsets()
  // A device with no household yet starts at the welcome screen.
  if (!household.exists) return <Redirect href="/welcome" />
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: p.bar }, headerTintColor: p.barText, headerTitleStyle: { fontWeight: '600' },
      tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border, height: TAB_BAR + insets.bottom },
      tabBarActiveTintColor: p.t1, tabBarInactiveTintColor: p.t3,
      tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
      // Settings sits behind the gear on every tab (the proviso-ui skill: no fifth tab).
      headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')}
          hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
          <Ionicons name="settings-outline" size={22} color={p.barText} />
        </Pressable>
      ),
    }}>
      <Tabs.Screen name="index"    options={{ title: 'Home',     headerTitle: 'Proviso', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="spending" options={{ title: 'Spending', tabBarIcon: icon('card-outline') }} />
      <Tabs.Screen name="wealth"   options={{ title: 'Wealth',   tabBarIcon: icon('bar-chart-outline') }} />
      <Tabs.Screen name="future"   options={{ title: 'Future',   tabBarIcon: icon('trending-up-outline') }} />
    </Tabs>
  )
}
