// Moving files in and out of the app: choosing one to read, and handing one
// to the phone's share sheet (save to Files, Drive, Dropbox, email…). On the
// web, a download.

import { Platform } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'

/** Lets the person choose a file and returns it parsed as JSON; null if they cancel. */
export async function pickJsonFile(): Promise<unknown | null> {
  const pick = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true })
  if (pick.canceled) return null
  const asset = pick.assets[0]
  const text = asset.file ? await asset.file.text() : await new File(asset.uri).text()
  try { return JSON.parse(text) } catch { throw new Error('That file couldn’t be read. Choose a Proviso backup or export file.') }
}

/** Offers a JSON document to save or send. */
export async function shareJson(fileName: string, doc: unknown, dialogTitle: string): Promise<void> {
  const text = JSON.stringify(doc)
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  const file = new File(Paths.cache, fileName)
  if (file.exists) file.delete()
  file.create()
  file.write(text)
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle })
  } finally {
    // The copy only existed to be shared; don't leave household data in the cache.
    if (file.exists) file.delete()
  }
}

/** A file name with today's date, e.g. proviso-backup-2026-10-06.json */
export const datedName = (stem: string, now: Date = new Date()) =>
  `${stem}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`
