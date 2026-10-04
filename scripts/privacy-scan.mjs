#!/usr/bin/env node
// Privacy gate for a PUBLIC repo. Blocks commits/pushes that would publish
// the developer's personal data. See CLAUDE.md § "Privacy guardrails".
//
// Two layers of checks:
//   1. A PRIVATE denylist of the developer's real names, places, contact
//      details and figures. It lives OUTSIDE the repo (it is personal data
//      itself) — default ../.proviso-private/denylist.txt, or $PROVISO_DENYLIST.
//      Required locally; optional in CI, where it doesn't exist.
//   2. Generic patterns needing no list: database/statement/secret files,
//      real-looking email addresses, AU phone numbers, private network
//      addresses, oversized files, non-noreply commit identities.
//
// Modes:
//   --staged          staged files + git user.email          (pre-commit hook)
//   --message <file>  a commit message                       (commit-msg hook)
//   --push            every commit being pushed, read from stdin (pre-push hook)
//   --tree [rev]      every file at a revision, default HEAD  (manual)
//   --all             every commit reachable from HEAD        (CI)
//   --ci              denylist optional (it doesn't exist in CI)
//
// Findings are printed MASKED, so a hit never ends up verbatim in a log
// (CI logs on a public repo are public too). Exit 1 = blocked.

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_DENYLIST = path.resolve(ROOT, '..', '.proviso-private', 'denylist.txt')
const ZERO_SHA = /^0+$/

// ── Generic rules ────────────────────────────────────────────────────────────

// Files that must never be committed, whatever they contain.
const FORBIDDEN_PATHS = [
  [/\.(db|sqlite3?|db-journal|db-wal|db-shm)$/i, 'database file'],
  [/\.(bak|dump)$/i, 'backup file'],
  [/(^|\/)\.env(\..+)?$/i, 'environment file (use .env.example)'],
  [/\.(csv|ofx|qif|qfx|xlsx?|numbers)$/i, 'spreadsheet / bank export'],
  [/\.pdf$/i, 'PDF (statements, payslips…)'],
  [/(^|\/)restore-[^/]*$/i, 'personal data restore script'],
  [/(^|\/)\.proviso-private(\/|$)/i, 'private denylist directory'],
  [/(^|\/)denylist\.txt$/i, 'denylist file'],
  // Images can't be text-scanned and screenshots of the running app show real
  // data. App assets belong in public/ (or app/ for the favicon).
  [/^(?!public\/|app\/)(.*\/)?[^/]+\.(png|jpe?g|gif|webp|heic|bmp|tiff?)$/i, 'image outside public/ (screenshots can show real data)'],
]
const ALLOWED_PATHS = [/(^|\/)\.env\.example$/i]

const MAX_FILE_BYTES = 512 * 1024
const SIZE_EXEMPT = [/(^|\/)package-lock\.json$/]
// Generated, third-party-shaped content: denylist only, no heuristics.
const HEURISTIC_EXEMPT = [/(^|\/)package-lock\.json$/]

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
const ALLOWED_EMAIL = [
  /@example\.(com|org|net)$/i,
  /@users\.noreply\.github\.com$/i,
  /^noreply@anthropic\.com$/i,
  /^onboarding@resend\.dev$/i,
  /^git@github\.com$/i,
]
const AU_PHONE = /(?<![\d.])(?:\+61\s?|0)[2-478](?:[\s-]?\d){8}(?!\d)/g
const PRIVATE_NET = /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}|[a-z0-9-]+\.[a-z0-9-]+\.ts\.net)\b/gi

// Commits must not expose a personal email address.
const ALLOWED_IDENTITY = [/@users\.noreply\.github\.com$/i, /^noreply@github\.com$/i]

// ── Denylist ─────────────────────────────────────────────────────────────────

function loadDenylist(required) {
  const file = process.env.PROVISO_DENYLIST || DEFAULT_DENYLIST
  if (!existsSync(file)) {
    if (!required) return []
    fail([`Private denylist not found at ${file}.`,
      'Refusing to continue: without it, personal data can\'t be detected.',
      'Create it (see CLAUDE.md § Privacy guardrails) or set PROVISO_DENYLIST.'])
  }
  return readFileSync(file, 'utf8').split(/\r?\n/)
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(term => ({ term, re: new RegExp(escapeRe(term), 'gi'), numeric: /^[\d.,-]+$/.test(term) }))
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Word terms: must start a word (not preceded by a letter) and not continue
// in lowercase — so "Alex" hits "AlexPhase"/"alex_fte" but not "alexandria".
// Numeric terms: must stand alone (no adjacent alphanumerics, no decimal
// continuation), so "1234" doesn't hit "51234" or a base64 hash.
function denyHits(text, deny) {
  const hits = []
  for (const d of deny) {
    d.re.lastIndex = 0
    let m
    while ((m = d.re.exec(text))) {
      const before = text[m.index - 1] ?? ''
      const after = text[m.index + m[0].length] ?? ''
      const after2 = text[m.index + m[0].length + 1] ?? ''
      const ok = d.numeric
        ? !/[A-Za-z0-9.]/.test(before) && !/[A-Za-z0-9]/.test(after) && !(after === '.' && /\d/.test(after2))
        : !/[A-Za-z]/.test(before) && !/[a-z]/.test(after)
      if (ok) hits.push({ index: m.index, rule: 'denylist', value: m[0] })
    }
  }
  return hits
}

function heuristicHits(text) {
  const hits = []
  for (const m of text.matchAll(EMAIL)) {
    if (!ALLOWED_EMAIL.some(a => a.test(m[0]))) hits.push({ index: m.index, rule: 'email address', value: m[0] })
  }
  for (const m of text.matchAll(AU_PHONE)) hits.push({ index: m.index, rule: 'phone number', value: m[0] })
  for (const m of text.matchAll(PRIVATE_NET)) hits.push({ index: m.index, rule: 'private network address', value: m[0] })
  return hits
}

// ── Reporting ────────────────────────────────────────────────────────────────

function mask(v) {
  const s = String(v)
  return s.length <= 2 ? '**' : `${s[0]}${'*'.repeat(Math.min(s.length - 2, 8))}${s[s.length - 1]}`
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

const findings = []
function report(where, rule, value) {
  findings.push(`${where}: [${rule}] ${value === undefined ? '' : mask(value)}`)
}

function scanText(label, text, deny, { heuristics = true } = {}) {
  const hits = denyHits(text, deny)
  if (heuristics) hits.push(...heuristicHits(text))
  for (const h of hits) report(`${label}:${lineOf(text, h.index)}`, h.rule, h.value)
}

function scanFile(label, filePath, buf, deny) {
  if (ALLOWED_PATHS.some(r => r.test(filePath))) return
  for (const [re, why] of FORBIDDEN_PATHS) {
    if (re.test(filePath)) { report(label, `forbidden file: ${why}`); return }
  }
  if (buf.length > MAX_FILE_BYTES && !SIZE_EXEMPT.some(r => r.test(filePath))) {
    report(label, `file over ${MAX_FILE_BYTES / 1024} KB — check it isn't data`)
  }
  scanText(label, buf.toString('latin1'), deny, { heuristics: !HEURISTIC_EXEMPT.some(r => r.test(filePath)) })
}

function checkIdentity(label, email) {
  if (!ALLOWED_IDENTITY.some(r => r.test(email))) report(label, 'personal email as git identity (use the GitHub noreply address)', email)
}

function fail(lines) {
  console.error('\n✋ privacy-scan: BLOCKED\n')
  for (const l of lines) console.error(`  ${l}`)
  console.error('\nThis repo is public. Remove the data (don\'t bypass the check), then retry.\n')
  process.exit(1)
}

// ── Git helpers ──────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, ...opts })
}
const gitText = args => git(args).toString('utf8')

function scanCommit(sha, deny, seenBlobs) {
  const short = sha.slice(0, 8)
  const [ae, ce] = gitText(['log', '-1', '--format=%ae%n%ce', sha]).trim().split('\n')
  checkIdentity(`${short} author`, ae)
  checkIdentity(`${short} committer`, ce)
  scanText(`${short} message`, gitText(['log', '-1', '--format=%B', sha]), deny)
  const entries = gitText(['ls-tree', '-r', '-z', sha]).split('\0').filter(Boolean)
  for (const e of entries) {
    const [meta, file] = e.split('\t')
    const blob = meta.split(' ')[2]
    if (seenBlobs.has(`${blob}:${file}`)) continue
    seenBlobs.add(`${blob}:${file}`)
    scanFile(`${short}:${file}`, file, git(['cat-file', 'blob', blob]), deny)
  }
}

// ── Modes ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const ci = args.includes('--ci')
const deny = loadDenylist(!ci)

if (args.includes('--staged')) {
  checkIdentity('git config user.email', gitText(['config', 'user.email']).trim())
  const files = gitText(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean)
  for (const f of files) scanFile(f, f, git(['show', `:${f}`]), deny)
} else if (args.includes('--message')) {
  const file = args[args.indexOf('--message') + 1]
  const msg = readFileSync(file, 'utf8').split('\n').filter(l => !l.startsWith('#')).join('\n')
  scanText('commit message', msg, deny)
} else if (args.includes('--push')) {
  const input = readFileSync(0, 'utf8').trim()
  const seen = new Set()
  for (const line of input ? input.split('\n') : []) {
    const [localRef, localSha, , remoteSha] = line.trim().split(/\s+/)
    if (!localSha || ZERO_SHA.test(localSha)) continue // deleting a remote ref
    if (gitText(['cat-file', '-t', localSha]).trim() === 'tag') {
      scanText(`${localRef} tag message`, gitText(['cat-file', '-p', localSha]), deny)
    }
    const range = ZERO_SHA.test(remoteSha) ? [localSha, '--not', '--remotes'] : [`${remoteSha}..${localSha}`]
    for (const sha of gitText(['rev-list', ...range]).split('\n').filter(Boolean)) scanCommit(sha, deny, seen)
  }
} else if (args.includes('--all')) {
  const seen = new Set()
  for (const sha of gitText(['rev-list', 'HEAD']).split('\n').filter(Boolean)) scanCommit(sha, deny, seen)
} else {
  const i = args.indexOf('--tree')
  const rev = i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'HEAD'
  const seen = new Set()
  if (ci) {
    scanCommit(gitText(['rev-parse', rev]).trim(), deny, seen)
  } else {
    for (const f of gitText(['ls-tree', '-r', '-z', '--name-only', rev]).split('\0').filter(Boolean)) {
      scanFile(f, f, git(['show', `${rev}:${f}`]), deny)
    }
  }
}

if (findings.length) fail(findings)
console.log(`privacy-scan: clean${deny.length ? ` (denylist: ${deny.length} terms)` : ' (generic checks only — no denylist)'}`)
