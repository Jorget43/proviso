// CSV parsing: CBA/NAB/ANZ/Westpac format (date, description, amount)
// Categorisation: custom rules first, then keyword rules (CAT_RULES)
// buildSuggestions: monthly items need 2+ months, quarterly 4+, yearly 10+
// Lumpy items (council, rego, insurance, holiday) are never auto-suggested

import { CATS, CAT_RULES, LUMPY_KW } from './constants';
import { toMonthly } from './formatting';

export interface ParsedTransaction {
  dateStr:     string;
  ym:          string;   // 'YYYY-MM' for coverage tracking
  desc:        string;
  amt:         number;   // negative = expense
  cat:         string;
  originalCat: string;
  catSource:   'custom' | 'system';
  ruleId:      number | null;
  lumpy:       boolean;
}

export interface CustomRule {
  id:      number;
  pattern: string;  // lowercase
  cat:     string;
  source:  'user' | 'system';
  hits:    number;
}

export interface Expense {
  id:   number;
  cat:  string;
  name: string;
  freq: string;
  amt:  number;
}

export interface Suggestion {
  budgeted:    number;
  actual:      number;
  diff:        number;
  pctDiff:     number;
  months:      number;
  needed:      number;
  hasData:     boolean;
  significant: boolean;
  status:      'pending' | 'accepted' | 'dismissed';
}

function cleanDesc(raw: string): string {
  return raw
    .replace(/\s+(AU|AUS|VIC|NSW|QLD|SA|WA|TAS|NT)\s*$/i, '')
    .replace(/card\s+xx\d+/gi, '')
    .replace(/value date.*/gi, '')
    .replace(/ref:\s*\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseAmount(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}

export function isLumpy(desc: string): boolean {
  return LUMPY_KW.some(k => desc.toLowerCase().includes(k));
}

export function extractMerchantPattern(desc: string): string {
  const p = desc.toLowerCase()
    .replace(/\d{4,}/g, '')
    .replace(/(au|vic|nsw|qld|sa|wa|tas|nt|aust|australia)/g, '')
    .replace(/(pty|ltd|pty ltd|inc|co|corp)/g, '')
    .replace(/(ref|inv|order|txn)[\s:]\S*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return p.split(' ').filter(w => w.length > 2).slice(0, 3).join(' ').trim();
}

export function applyCustomRules(
  desc: string,
  customRules: CustomRule[],
): { cat: string; ruleId: number } | null {
  const dl = desc.toLowerCase();
  for (const r of customRules) {
    if (dl.includes(r.pattern.toLowerCase())) {
      return { cat: r.cat, ruleId: r.id };
    }
  }
  return null;
}

export function categorizeTxn(desc: string, customRules: CustomRule[]): string {
  const custom = applyCustomRules(desc, customRules);
  if (custom) return custom.cat;
  const dl = desc.toLowerCase();
  for (const [cat, kws] of CAT_RULES) {
    if (kws.some(k => dl.includes(k))) return cat;
  }
  return 'Other';
}

export function categorizeTxnWithSource(
  desc: string,
  customRules: CustomRule[],
): { cat: string; source: 'custom' | 'system'; ruleId: number | null } {
  const custom = applyCustomRules(desc, customRules);
  if (custom) return { cat: custom.cat, source: 'custom', ruleId: custom.ruleId };
  const dl = desc.toLowerCase();
  for (const [cat, kws] of CAT_RULES) {
    if (kws.some(k => dl.includes(k))) return { cat, source: 'system', ruleId: null };
  }
  return { cat: 'Other', source: 'system', ruleId: null };
}

let _parseIdCounter = 0;

export function parseCsvText(raw: string, customRules: CustomRule[]): ParsedTransaction[] {
  const txns: ParsedTransaction[] = [];

  for (const line of raw.trim().split('\n')) {
    const l = line.trim();
    if (!l) continue;

    const cols = l.match(/(".*?"|[^,]+)(?:,|$)/g) || [];
    const c = cols.map(p => p.replace(/,$/, '').replace(/^"|"$/g, '').trim());

    if (c.length < 2 || !/\d/.test(c[0])) continue;

    const desc = cleanDesc(c[1] || 'Unknown');
    let amt: number | null = null;
    if (c.length >= 3) amt = parseAmount(c[2]);
    if (amt === null && c.length >= 4) amt = parseAmount(c[3]);
    if (amt === null) continue;

    const dm = c[0].match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    let ym = 'unknown';
    if (dm) {
      const yr = dm[3].length === 2 ? '20' + dm[3] : dm[3];
      ym = yr + '-' + dm[2].padStart(2, '0');
    }

    const catResult = categorizeTxnWithSource(desc, customRules);
    txns.push({
      dateStr:     c[0],
      ym,
      desc,
      amt,
      cat:         catResult.cat,
      originalCat: catResult.cat,
      catSource:   catResult.source,
      ruleId:      catResult.ruleId,
      lumpy:       isLumpy(desc),
    });
  }

  return txns;
}

export function computeActualsAverages(
  txnHistory:    ParsedTransaction[],
  monthsCovered: Set<string>,
): Record<string, number> {
  if (!txnHistory.length || !monthsCovered.size) return {};

  const nM = monthsCovered.size;
  const catSumsR: Record<string, number> = {};
  const catSumsL: Record<string, number> = {};

  for (const t of txnHistory) {
    if (t.amt >= 0) continue;
    const abs = Math.abs(t.amt);
    const cat = CATS.includes(t.cat as typeof CATS[number]) ? t.cat : null;
    if (!cat) continue;
    if (t.lumpy) {
      catSumsL[cat] = (catSumsL[cat] || 0) + abs;
    } else {
      catSumsR[cat] = (catSumsR[cat] || 0) + abs;
    }
  }

  const avgs: Record<string, number> = {};
  for (const [cat, sum] of Object.entries(catSumsR)) avgs[cat] = (avgs[cat] || 0) + sum / nM;
  for (const [cat, sum] of Object.entries(catSumsL)) avgs[cat] = (avgs[cat] || 0) + sum / 12;
  return avgs;
}

export function computeMonthlySpend(
  txnHistory: ParsedTransaction[],
): Record<string, number> {
  const byM: Record<string, number> = {};
  for (const t of txnHistory) {
    if (t.amt >= 0 || t.ym === 'unknown') continue;
    byM[t.ym] = (byM[t.ym] || 0) + Math.abs(t.amt);
  }
  return byM;
}

function inferDomFreq(cat: string, expenses: Expense[]): string {
  const items = expenses.filter(e => e.cat === cat);
  if (!items.length) return 'monthly';
  const fc: Record<string, number> = {};
  items.forEach(e => { fc[e.freq] = (fc[e.freq] || 0) + 1; });
  return Object.entries(fc).sort((a, b) => b[1] - a[1])[0][0];
}

function minMonths(freq: string): number {
  if (freq === 'monthly')   return 2;
  if (freq === 'quarterly') return 4;
  if (freq === 'yearly')    return 10;
  return 3;
}

export function buildSuggestions(
  txnHistory:      ParsedTransaction[],
  monthsCovered:   Set<string>,
  expenses:        Expense[],
  prevSuggestions: Record<string, Suggestion> = {},
): Record<string, Suggestion> {
  const avgs = computeActualsAverages(txnHistory, monthsCovered);
  const nM   = monthsCovered.size;

  const catMonthly: Record<string, number> = {};
  for (const cat of CATS) catMonthly[cat] = 0;
  for (const e of expenses) {
    if (catMonthly[e.cat] !== undefined) catMonthly[e.cat] += toMonthly(e.amt, e.freq);
  }

  const result: Record<string, Suggestion> = {};

  for (const cat of CATS) {
    if (!avgs[cat] && !catMonthly[cat]) continue;
    const budgeted = catMonthly[cat] || 0;
    const actual   = avgs[cat] || 0;
    const diff     = actual - budgeted;
    const pctDiff  = budgeted > 0 ? diff / budgeted : 1;
    const freq     = inferDomFreq(cat, expenses);
    const needed   = minMonths(freq);
    const prev     = prevSuggestions[cat];

    result[cat] = {
      budgeted,
      actual,
      diff,
      pctDiff,
      months:      nM,
      needed,
      hasData:     nM >= needed,
      significant: Math.abs(pctDiff) > 0.05 && actual > 0,
      status:      prev?.status || 'pending',
    };
  }

  return result;
}
