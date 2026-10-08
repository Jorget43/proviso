import { Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { DataProvider } from '@/data/DataProvider'
import { usePalette, space } from '@/ui/theme'
import { ThemeProvider } from '@/ui/ThemeProvider'
import { T } from '@/ui/kit'

function Centered({ children }: { children: React.ReactNode }) {
  const p = usePalette()
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: p.bg, gap: space.md }}>{children}</View>
}

export default function RootLayout() {
  return <ThemeProvider><Root /></ThemeProvider>
}

function Root() {
  const p = usePalette()
  const page = { headerShown: true, title: '', headerStyle: { backgroundColor: p.bar }, headerTintColor: p.barText }
  const sheet = { presentation: 'modal' as const, headerShown: true, title: '', headerStyle: { backgroundColor: p.surface }, headerTintColor: p.t1 }
  return (
    <SafeAreaProvider>
      <DataProvider
        loading={<Centered><ActivityIndicator color={p.t2} /></Centered>}
        failed={message => (
          <Centered>
            <T size="title" weight="600">Proviso couldn’t open your data</T>
            <T tone="t2" style={{ textAlign: 'center' }}>{message}</T>
          </Centered>
        )}
      >
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="setup" />
          {/* Full pages with a back button */}
          {['settings', 'recovery', 'restore', 'sync', 'join', 'cashflow'].map(name => <Stack.Screen key={name} name={name} options={page} />)}
          {/* Forms over a tab */}
          {['expense', 'income', 'item', 'loan', 'super', 'assumptions', 'whatif', 'oneoff', 'people', 'rent', 'childcare'].map(name => <Stack.Screen key={name} name={name} options={sheet} />)}
        </Stack>
      </DataProvider>
    </SafeAreaProvider>
  )
}
