// This device's copy of the household identity: the household id and the
// household key (@proviso/core/backup), in secure storage (iOS Keychain /
// Android Keystore via expo-secure-store). Never in the database, never in an
// export or backup file.
//
// On the web (a development build for now) there is no secure store, so it
// falls back to localStorage. The web client phase replaces this.

import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { newId } from '@proviso/core/ids'
import { newHouseholdKey, keyToHex, keyFromHex } from '@proviso/core/backup'

export interface Identity {
  householdId: string
  key:         Uint8Array
  /** The person has confirmed they wrote the recovery phrase down. */
  phraseSaved: boolean
}

const K = { id: 'proviso.householdId', key: 'proviso.householdKey', saved: 'proviso.phraseSaved' }

const web = Platform.OS === 'web'
async function get(name: string): Promise<string | null> {
  if (web) { try { return globalThis.localStorage?.getItem(name) ?? null } catch { return null } }
  return SecureStore.getItemAsync(name)
}
async function set(name: string, value: string | null): Promise<void> {
  if (web) {
    try { if (value === null) globalThis.localStorage?.removeItem(name); else globalThis.localStorage?.setItem(name, value) } catch { /* private window */ }
    return
  }
  if (value === null) await SecureStore.deleteItemAsync(name)
  // Readable once the phone has been unlocked since starting, and never
  // copied to another phone by a device backup: the recovery phrase is how a
  // household moves to a new phone.
  else await SecureStore.setItemAsync(name, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY })
}

export async function loadIdentity(): Promise<Identity | null> {
  const [id, key, saved] = await Promise.all([get(K.id), get(K.key), get(K.saved)])
  if (!id || !key) return null
  return { householdId: id, key: keyFromHex(key), phraseSaved: saved === 'yes' }
}

export async function saveIdentity(i: Identity): Promise<Identity> {
  await set(K.id, i.householdId)
  await set(K.key, keyToHex(i.key))
  await set(K.saved, i.phraseSaved ? 'yes' : null)
  return i
}

/** A brand-new identity: a new household (start fresh, or a NAS file that has no key yet). */
export const freshIdentity = (householdId: string = newId()): Identity =>
  ({ householdId, key: newHouseholdKey(), phraseSaved: false })

/** The identity, made now if this device's household predates them. */
export async function ensureIdentity(): Promise<Identity> {
  return (await loadIdentity()) ?? saveIdentity(freshIdentity())
}

export async function markPhraseSaved(): Promise<void> {
  await set(K.saved, 'yes')
}

export async function forgetIdentity(): Promise<void> {
  await Promise.all([set(K.id, null), set(K.key, null), set(K.saved, null)])
}
