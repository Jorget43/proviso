// The recovery phrase: shown, written down, then checked by asking for two of
// the words, so "I wrote it down" means something.

import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { recoveryPhrase, normalisePhrase } from '@proviso/core/backup'
import { useIdentity } from '@/data/useIdentity'
import { markPhraseSaved } from '@/data/identity'
import { Button, Card, Field, Screen, T, TextField } from '@/ui/kit'
import { usePalette, space, radius } from '@/ui/theme'

export default function Recovery() {
  const identity = useIdentity()
  const p = usePalette()
  const [step, setStep] = useState<'intro' | 'words' | 'check' | 'done'>('intro')
  const words = useMemo(() => (identity ? recoveryPhrase(identity.key).split(' ') : []), [identity])
  // Two different positions to check, chosen once.
  const [ask] = useState(() => {
    const a = Math.floor(Math.random() * 24)
    let b = Math.floor(Math.random() * 23); if (b >= a) b++
    return [a, b].sort((x, y) => x - y)
  })
  const [answers, setAnswers] = useState(['', ''])
  const [error, setError] = useState<string | null>(null)

  async function check() {
    const ok = ask.every((pos, i) => normalisePhrase(answers[i]) === words[pos])
    if (!ok) { setError('Those don’t match. Check what you wrote down, or go back and look again.'); return }
    await markPhraseSaved()
    setStep('done')
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Recovery phrase', headerShown: true }} />

      {step === 'intro' && (
        <>
          <T size="title" weight="700">Your recovery phrase</T>
          <T>24 words that unlock your backups. With a backup file and these words, you can bring your household back on a new phone.</T>
          <View style={{ backgroundColor: p.amberLt, borderRadius: radius.md, padding: space.md, gap: space.xs }}>
            <T weight="600">Before you look:</T>
            <T>• Write the words on paper, in order. Don’t screenshot them.</T>
            <T>• Keep the paper somewhere safe, away from your phone.</T>
            <T>• Anyone with the words and a backup can read your finances.</T>
            <T>• If you lose your phone and the words, nobody can recover your data, not even us.</T>
          </View>
          <Button title="Show the words" onPress={() => setStep('words')} disabled={!identity} />
        </>
      )}

      {step === 'words' && (
        <>
          <T>Write these down in order.</T>
          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
            {words.map((w, i) => (
              <View key={i} style={{ width: '50%', flexDirection: 'row', gap: space.sm, paddingVertical: space.xs }}>
                <T tone="t3" style={{ width: 24, textAlign: 'right' }}>{i + 1}</T>
                <T weight="600">{w}</T>
              </View>
            ))}
          </Card>
          <Button title="I’ve written them down" onPress={() => setStep('check')} />
          <Button kind="quiet" title="Not now" onPress={() => router.back()} />
        </>
      )}

      {step === 'check' && (
        <>
          <T size="title" weight="700">Check your copy</T>
          <T tone="t2">From what you wrote down:</T>
          {ask.map((pos, i) => (
            <Field key={pos} label={`Word ${pos + 1}`}>
              <TextField label={`Word ${pos + 1}`} value={answers[i]} onChange={v => setAnswers(a => a.map((x, j) => (j === i ? v : x)))} />
            </Field>
          ))}
          {error && <T tone="red" accessibilityRole="alert">{error}</T>}
          <Button title="Check" onPress={check} />
          <Button kind="quiet" title="Look at the words again" onPress={() => { setError(null); setStep('words') }} />
        </>
      )}

      {step === 'done' && (
        <>
          <T size="title" weight="700">All set</T>
          <T>Your recovery phrase is saved on paper. Now save a backup from Settings, and do it again now and then.</T>
          <Button title="Done" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  )
}
