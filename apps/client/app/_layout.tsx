import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { DataProvider } from '@/data/DataProvider'
import { usePalette, space } from '@/ui/theme'
import { T } from '@/ui/kit'

function Centered({ children }: { children: React.ReactNode }) {
  const p = usePalette()
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: p.bg, gap: space.md }}>{children}</View>
}

export default function RootLayout() {
  const p = usePalette()
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
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
          <Stack.Screen name="expense" options={{ presentation: 'modal', headerShown: true, title: '', headerStyle: { backgroundColor: p.surface }, headerTintColor: p.t1 }} />
        </Stack>
      </DataProvider>
    </SafeAreaProvider>
  )
}
