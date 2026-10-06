// This device's household identity for screens, re-read whenever the screen
// comes into view (the recovery and restore screens change it).

import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { ensureIdentity, type Identity } from './identity'

export function useIdentity(): Identity | null {
  const [identity, setIdentity] = useState<Identity | null>(null)
  useFocusEffect(useCallback(() => {
    let alive = true
    ensureIdentity().then(i => { if (alive) setIdentity(i) }).catch(() => { /* shown as not set up */ })
    return () => { alive = false }
  }, []))
  return identity
}
