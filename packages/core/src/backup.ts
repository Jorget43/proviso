// The household key, its recovery phrase, and encrypted backups
// (docs/architecture.md, D4).
//
//   - The household key is 32 random bytes, made once per household and kept
//     in each device's secure storage. Sync (Phase 4) encrypts with it too.
//   - The recovery phrase is that key as 24 English words (BIP-39, with its
//     checksum, so a mistyped word is caught rather than giving a wrong key).
//   - An encrypted backup is a household export (householdExport.ts), sealed
//     with AES-256-GCM under a key derived from the household key (HKDF), so
//     backup files and sync messages never share a key.
//
// Pure TypeScript on audited libraries (@noble, @scure): the same on phones,
// in browsers, on the NAS and on the relay.

import { gcm } from '@noble/ciphers/aes.js'
import { randomBytes, utf8ToBytes, bytesToUtf8, bytesToHex, hexToBytes } from '@noble/ciphers/utils.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { parseHouseholdExport, type HouseholdExport } from './householdExport'

export const KEY_BYTES = 32
export const BACKUP_FORMAT  = 'proviso-backup'
export const BACKUP_VERSION = 1

export class RecoveryPhraseError extends Error {
  constructor(message: string) { super(message); this.name = 'RecoveryPhraseError' }
}
export class BackupError extends Error {
  constructor(message: string) { super(message); this.name = 'BackupError' }
}

export function newHouseholdKey(): Uint8Array {
  return randomBytes(KEY_BYTES)
}

/** The household key as 24 words. */
export function recoveryPhrase(key: Uint8Array): string {
  if (key.length !== KEY_BYTES) throw new RecoveryPhraseError('A household key is 32 bytes.')
  return entropyToMnemonic(key, wordlist)
}

/** Tidies a typed phrase: lower case, single spaces, numbering and punctuation removed. */
export function normalisePhrase(input: string): string {
  return input.toLowerCase().replace(/\d+[.)]/g, ' ').replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).join(' ')
}

/** The household key from its phrase. Throws RecoveryPhraseError, in plain words, when it isn't right. */
export function keyFromPhrase(input: string): Uint8Array {
  const phrase = normalisePhrase(input)
  const words = phrase ? phrase.split(' ') : []
  if (words.length !== 24) throw new RecoveryPhraseError(`A recovery phrase has 24 words; this has ${words.length}.`)
  const unknown = words.filter(w => !wordlist.includes(w))
  if (unknown.length) throw new RecoveryPhraseError(`These aren’t recovery-phrase words: ${unknown.slice(0, 3).join(', ')}. Check the spelling.`)
  if (!validateMnemonic(phrase, wordlist)) throw new RecoveryPhraseError('Those words don’t fit together. One may be wrong or out of order.')
  return mnemonicToEntropy(phrase, wordlist)
}

// ── Encrypted backups ────────────────────────────────────────────────────────

export interface BackupFile {
  format:    typeof BACKUP_FORMAT
  version:   typeof BACKUP_VERSION
  createdAt: string            // ISO timestamp; everything else is inside the ciphertext
  cipher:    'AES-256-GCM'
  kdf:       'HKDF-SHA256'
  nonce:     string            // base64, 12 bytes
  data:      string            // base64 ciphertext (with the GCM tag)
}

const INFO = utf8ToBytes('proviso backup v1')
const backupKey = (key: Uint8Array) => hkdf(sha256, key, undefined, INFO, 32)

// Base64 without relying on btoa/atob (core runs where they may not exist).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
export function toB64(b: Uint8Array): string {
  let out = ''
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0)
    out += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (i + 1 < b.length ? B64[n >> 6 & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=')
  }
  return out
}
export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4))
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63)
    if (o < out.length) out[o++] = n >> 16 & 255
    if (o < out.length) out[o++] = n >> 8 & 255
    if (o < out.length) out[o++] = n & 255
  }
  return out
}

export function encryptBackup(doc: HouseholdExport, key: Uint8Array, now: Date = new Date()): BackupFile {
  const nonce = randomBytes(12)
  const plain = utf8ToBytes(JSON.stringify(doc))
  const sealed = gcm(backupKey(key), nonce).encrypt(plain)
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now.toISOString(), cipher: 'AES-256-GCM', kdf: 'HKDF-SHA256', nonce: toB64(nonce), data: toB64(sealed) }
}

export function isBackupFile(x: unknown): x is BackupFile {
  return typeof x === 'object' && x !== null && (x as { format?: unknown }).format === BACKUP_FORMAT
}

/** Opens a backup. Throws BackupError when it's damaged or the key is wrong. */
export function decryptBackup(file: unknown, key: Uint8Array): HouseholdExport {
  if (!isBackupFile(file)) throw new BackupError('That isn’t a Proviso backup file.')
  if (file.version !== BACKUP_VERSION) throw new BackupError('This backup was made by a newer version of Proviso. Update the app, then try again.')
  let plain: Uint8Array
  try {
    plain = gcm(backupKey(key), fromB64(file.nonce)).decrypt(fromB64(file.data))
  } catch {
    throw new BackupError('This backup can’t be opened with that recovery phrase. It may belong to a different household, or the file may be damaged.')
  }
  return parseHouseholdExport(JSON.parse(bytesToUtf8(plain)))
}

export const keyToHex = (k: Uint8Array) => bytesToHex(k)
export const keyFromHex = (h: string) => hexToBytes(h)

// ── The key in a password manager (D4's second recovery route) ───────────────
// Saved as a "password" in iCloud Keychain or Google Password Manager: the
// household id and key, versioned so the format can change. The "account"
// shown in the password manager names no person.

const SECRET_PREFIX = 'proviso-key-1'

export const keyBackupAccount = (householdId: string) => `Proviso household ${householdId.slice(0, 8)}`

export function keyBackupSecret(householdId: string, key: Uint8Array): string {
  if (key.length !== KEY_BYTES) throw new RecoveryPhraseError('A household key is 32 bytes.')
  return `${SECRET_PREFIX}:${householdId}:${bytesToHex(key)}`
}

/** Reads a saved secret back. Null when it isn't one of ours (or is damaged). */
export function parseKeyBackupSecret(secret: string): { householdId: string; key: Uint8Array } | null {
  const m = /^proviso-key-1:([0-9a-f-]{36}):([0-9a-f]{64})$/.exec(secret.trim())
  return m ? { householdId: m[1], key: hexToBytes(m[2]) } : null
}
