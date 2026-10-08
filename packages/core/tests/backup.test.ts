import { describe, it, expect } from 'vitest'
import {
  newHouseholdKey, recoveryPhrase, keyFromPhrase, normalisePhrase, encryptBackup, decryptBackup, isBackupFile,
  keyToHex, keyFromHex, toB64, fromB64, RecoveryPhraseError, BackupError,
  keyBackupAccount, keyBackupSecret, parseKeyBackupSecret,
} from '../src/backup'
import { emptyHouseholdTables, EXPORT_FORMAT, EXPORT_VERSION, type HouseholdExport } from '../src/householdExport'
import { SCHEMA_VERSION, SETTINGS_ID } from '../src/schema'

// The BIP-39 reference vector for 32 bytes of 0x00: "abandon" × 23 + "art".
const ZERO = new Uint8Array(32)
const ZERO_PHRASE = Array(23).fill('abandon').join(' ') + ' art'

function sample(): HouseholdExport {
  const household = emptyHouseholdTables()
  household.householdSettings.push({ id: SETTINGS_ID.household, deletedAt: null, person1Name: 'Alex', person2Name: 'Sam', partnerEnabled: true, onboardingDone: true })
  return {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: '2026-10-06T00:00:00.000Z',
    householdId: '0192a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', source: { app: 'test', version: '0' }, household, pocketMoney: [], notes: [],
  }
}

describe('recovery phrase', () => {
  it('matches the BIP-39 reference vector', () => {
    expect(recoveryPhrase(ZERO)).toBe(ZERO_PHRASE)
    expect(keyFromPhrase(ZERO_PHRASE)).toEqual(ZERO)
  })

  it('round-trips a random key through 24 words', () => {
    const key = newHouseholdKey()
    const phrase = recoveryPhrase(key)
    expect(phrase.split(' ')).toHaveLength(24)
    expect(keyFromPhrase(phrase)).toEqual(key)
  })

  it('accepts a phrase typed with numbers, capitals and line breaks', () => {
    const key = newHouseholdKey()
    const messy = recoveryPhrase(key).split(' ').map((w, i) => `${i + 1}. ${i % 3 ? w : w.toUpperCase()}`).join('\n')
    expect(normalisePhrase(messy)).toBe(recoveryPhrase(key))
    expect(keyFromPhrase(messy)).toEqual(key)
  })

  it('says what’s wrong: word count, unknown words, a wrong word', () => {
    expect(() => keyFromPhrase('abandon abandon')).toThrow(/24 words; this has 2/)
    expect(() => keyFromPhrase(ZERO_PHRASE.replace('art', 'artt'))).toThrow(/artt/)
    // A real word in the wrong place fails the checksum
    expect(() => keyFromPhrase(ZERO_PHRASE.replace('art', 'zoo'))).toThrow(RecoveryPhraseError)
  })
})

describe('encrypted backups', () => {
  it('round-trips an export, and nothing readable is left outside the ciphertext', () => {
    const key = newHouseholdKey()
    const file = encryptBackup(sample(), key, new Date('2026-10-06T01:02:03Z'))
    expect(isBackupFile(file)).toBe(true)
    expect(file.createdAt).toBe('2026-10-06T01:02:03.000Z')
    expect(JSON.stringify(file)).not.toMatch(/Alex|household|0192a1b2/)
    expect(decryptBackup(JSON.parse(JSON.stringify(file)), key)).toEqual(sample())
  })

  it('uses a fresh nonce each time', () => {
    const key = newHouseholdKey()
    expect(encryptBackup(sample(), key).nonce).not.toBe(encryptBackup(sample(), key).nonce)
  })

  it('refuses the wrong key and a tampered file, in plain words', () => {
    const file = encryptBackup(sample(), newHouseholdKey())
    expect(() => decryptBackup(file, newHouseholdKey())).toThrow(/can’t be opened with that recovery phrase/)
    const data = fromB64(file.data); data[5] ^= 1
    expect(() => decryptBackup({ ...file, data: toB64(data) }, keyFromHex(keyToHex(newHouseholdKey())))).toThrow(BackupError)
    expect(() => decryptBackup({ format: 'proviso-household' }, newHouseholdKey())).toThrow(/isn’t a Proviso backup/)
    expect(() => decryptBackup({ ...file, version: 2 }, newHouseholdKey())).toThrow(/newer version/)
  })
})

describe('encodings', () => {
  it('base64 matches the standard, every length', () => {
    for (let n = 0; n < 40; n++) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255)
      expect(toB64(b)).toBe(Buffer.from(b).toString('base64'))
      expect(fromB64(toB64(b))).toEqual(b)
    }
  })

  it('hex round-trips the key', () => {
    const k = newHouseholdKey()
    expect(keyFromHex(keyToHex(k))).toEqual(k)
  })
})

describe('key saved in a password manager', () => {
  it('round-trips the household id and key, and names no person', () => {
    const key = newHouseholdKey()
    const id = '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b'
    const secret = keyBackupSecret(id, key)
    expect(secret).toMatch(/^proviso-key-1:/)
    expect(parseKeyBackupSecret(` ${secret} `)).toEqual({ householdId: id, key })
    expect(keyBackupAccount(id)).toBe('Proviso household 0192a3b4')
  })

  it('ignores anything else a password manager might hand back', () => {
    expect(parseKeyBackupSecret('hunter2')).toBeNull()
    expect(parseKeyBackupSecret('proviso-key-1:not-an-id:00')).toBeNull()
    expect(parseKeyBackupSecret('proviso-key-2:0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b:' + '0'.repeat(64))).toBeNull()
  })
})
