// Device glue for the second recovery route (docs/architecture.md, D4): the
// household key saved to iCloud Keychain or Google Password Manager through
// the app's own native module (modules/key-backup). Null store name: not
// available here (Expo Go, the web build), and the app doesn't offer it.

import { keyBackupAccount, keyBackupSecret, parseKeyBackupSecret } from '@proviso/core/backup'
import { keyBackup } from '../../modules/key-backup'
import { markKeyInStore, type Identity } from './identity'

/** "iCloud Keychain", "Google Password Manager", or null when there's none. */
export const keyStoreName: string | null = keyBackup?.storeName ?? null

/** Saves the key. False if the person cancelled the system prompt. */
export async function saveKeyToStore(identity: Identity): Promise<boolean> {
  if (!keyBackup) return false
  const r = await keyBackup.save(keyBackupAccount(identity.householdId), keyBackupSecret(identity.householdId, identity.key))
  if (r === 'saved') await markKeyInStore()
  return r === 'saved'
}

/** Household keys this app finds in the password manager (Android asks which one). */
export async function keysFromStore(): Promise<{ householdId: string; key: Uint8Array }[]> {
  if (!keyBackup) return []
  const found = await keyBackup.restore()
  return found.flatMap(f => parseKeyBackupSecret(f.secret) ?? [])
}
