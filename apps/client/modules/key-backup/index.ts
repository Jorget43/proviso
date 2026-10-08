// The household key in the platform's synced password store: iCloud Keychain
// on iOS, Google Password Manager on Android (native code in ios/ and
// android/). Not present in Expo Go or on the web: `keyBackup` is null there
// and the app doesn't offer it.

import { requireOptionalNativeModule } from 'expo'

interface KeyBackupNative {
  /** "iCloud Keychain" or "Google Password Manager". */
  storeName: string
  save(account: string, secret: string): Promise<'saved' | 'cancelled'>
  /** Saved keys this app can read (Android asks the person to pick one). */
  restore(): Promise<{ account: string; secret: string }[]>
}

export const keyBackup = requireOptionalNativeModule<KeyBackupNative>('KeyBackup')
