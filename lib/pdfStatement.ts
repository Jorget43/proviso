// Parse extracted bank / credit-card statement TEXT into transactions.
//
// Statement layouts vary wildly between banks, so this is deliberately tolerant:
// it scans the whole text for date anchors, treats the text between two dates as
// one transaction, takes the first money amount on it as the value (a trailing
// running balance is ignored), and reuses the Actuals categoriser. Everything is
// shown in the review table before commit, so fuzzy rows are easy to correct.

import {
  categorizeTxnWithSource, isLumpy,
  type ParsedTransaction, type CustomRule,
} from './actuals'

export type StatementSource = 'bank' | 'card'

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// Income-ish descriptions flip an unsigned amount positive on a bank statement.
const INCOME_KW = ['salary', 'payroll', 'wages', 'direct credit', 'interest', 'refund', 'rebate', 'dividend', 'centrelink', 'tax refund']
// Card payments / credits are money coming IN to the card → positive.
const CARD_CREDIT_KW = ['payment received', 'payment - thank you', 'thank you', 'direct debit', 'bpay', 'refund', 'credit', 'reversal']

// A date at the start of a transaction: "02 Jan 2025", "2 January 25", "02/01/2025", "2-1-25".
const DATE_RE = /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{2,4})?|(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/gi
// Money with cents, optional $, sign, parentheses, or CR/DR suffix.
const MONEY_RE = /(\()?\s*(-|\+)?\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\s*(\))?\s*(CR|DR)?/gi

interface ParsedDate { ym: string; dateStr: string }

function parseDate(m: RegExpExecArray, fallbackYear: number): ParsedDate | null {
  if (m[2]) {
    // "02 Jan 2025"
    const day = m[1].padStart(2, '0')
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)]
    let yr = m[3] ? parseInt(m[3]) : fallbackYear
    if (yr < 100) yr += 2000
    if (!mon) return null
    return { ym: `${yr}-${String(mon).padStart(2, '0')}`, dateStr: `${day} ${m[2].slice(0, 3)} ${yr}` }
  }
  if (m[4]) {
    // "02/01/2025" — assume DD/MM/YYYY (AU)
    const day = m[4].padStart(2, '0')
    const mon = m[5].padStart(2, '0')
    let yr = parseInt(m[6])
    if (yr < 100) yr += 2000
    if (parseInt(mon) > 12) return null
    return { ym: `${yr}-${mon}`, dateStr: `${day}/${mon}/${yr}` }
  }
  return null
}

function cleanDesc(raw: string): string {
  return raw
    .replace(MONEY_RE, ' ')
    .replace(/\b(AU|AUS|VIC|NSW|QLD|SA|WA|TAS|NT|AUSTRALIA)\b/gi, ' ')
    .replace(/card\s+x+\d+/gi, ' ')
    .replace(/value date.*$/gi, ' ')
    .replace(/(ref|inv|order|txn|receipt)[\s:]\S*/gi, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/[\s|]{2,}/g, ' ')
    .trim()
}

function pickAmount(chunk: string, source: StatementSource, desc: string): number | null {
  MONEY_RE.lastIndex = 0
  const tokens: { value: number; explicit: boolean }[] = []
  let m: RegExpExecArray | null
  while ((m = MONEY_RE.exec(chunk)) !== null) {
    const negParen = !!m[1] && !!m[5]
    const sign     = m[2]
    const suffix   = m[6]?.toUpperCase()
    const num      = parseFloat(`${m[3].replace(/,/g, '')}.${m[4]}`)
    let value = num
    let explicit = false
    if (negParen || sign === '-' || suffix === 'DR') { value = -num; explicit = true }
    else if (sign === '+' || suffix === 'CR')         { value =  num; explicit = true }
    tokens.push({ value, explicit })
  }
  if (!tokens.length) return null

  // First money on the row is the transaction; any second is a running balance.
  const first = tokens[0]
  if (first.explicit) return first.value

  // No explicit sign: infer from description and statement type.
  const dl = desc.toLowerCase()
  if (source === 'bank') {
    if (INCOME_KW.some(k => dl.includes(k))) return Math.abs(first.value)
    return -Math.abs(first.value)
  }
  // Card: purchases are spending (negative); payments/credits are positive.
  if (CARD_CREDIT_KW.some(k => dl.includes(k))) return Math.abs(first.value)
  return -Math.abs(first.value)
}

export function parseStatementText(
  raw: string,
  customRules: CustomRule[],
  source: StatementSource,
): ParsedTransaction[] {
  if (!raw.trim()) return []
  const fallbackYear = new Date().getFullYear()

  // Locate every date anchor.
  DATE_RE.lastIndex = 0
  const anchors: { index: number; date: ParsedDate }[] = []
  let m: RegExpExecArray | null
  while ((m = DATE_RE.exec(raw)) !== null) {
    const d = parseDate(m, fallbackYear)
    if (d) anchors.push({ index: m.index, date: d })
  }
  if (!anchors.length) return []

  const txns: ParsedTransaction[] = []
  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i].index
    const end   = i + 1 < anchors.length ? anchors[i + 1].index : raw.length
    const chunk = raw.slice(start, end)
    if (chunk.length > 400) continue // unlikely a transaction; skip noise

    const desc = cleanDesc(chunk) || 'Unknown'
    const amt  = pickAmount(chunk, source, desc)
    if (amt === null || amt === 0) continue

    const cat = categorizeTxnWithSource(desc, customRules)
    txns.push({
      dateStr:     anchors[i].date.dateStr,
      ym:          anchors[i].date.ym,
      desc,
      amt,
      cat:         cat.cat,
      originalCat: cat.cat,
      catSource:   cat.source,
      ruleId:      cat.ruleId,
      lumpy:       isLumpy(desc),
    })
  }
  return txns
}
