'use client'
import { useState, useMemo, useCallback, useRef, type CSSProperties } from 'react'
import { CATS } from '@/lib/constants'
import { toMonthly, fmt, fmtS } from '@/lib/formatting'
import {
  parseCsvText, computeActualsAverages, computeMonthlySpend,
  buildSuggestions, extractMerchantPattern,
  type ParsedTransaction, type CustomRule, type Suggestion,
} from '@/lib/actuals'
import { parseStatementText, type StatementSource } from '@/lib/pdfStatement'
import { extractPdfText } from '@/lib/pdfExtract'
import Panel from '@/components/ui/Panel'
import SpendHistoryChart from './SpendHistoryChart'

type SuggStatus = 'pending' | 'accepted' | 'dismissed'

interface DbTxn {
  id: number; dateStr: string; ym: string; desc: string; amt: number
  cat: string; originalCat: string; catSource: string; lumpy: boolean
}
interface ExpenseItem { id: number; cat: string; name: string; freq: string; amt: number }

interface ActualsClientProps {
  initialTxns:        DbTxn[]
  initialRules:       CustomRule[]
  initialSuggStatus:  Record<string, SuggStatus>
  initialExpenses:    ExpenseItem[]
  initialUseActuals:  boolean
}

const SAMPLE_CSV = `01/05/2026,WOOLWORTHS WARRANWOOD,-142.50
03/05/2026,NETFLIX.COM,-22.99
04/05/2026,COLES CROYDON,-87.40
05/05/2026,SALARY JORGE CREDIT,9176.00
06/05/2026,GRACE SALARY,4436.40
07/05/2026,AGL GAS,-102.00
08/05/2026,TELSTRA MOBILE,-43.00
10/05/2026,PETBARN CROYDON,-89.00
12/05/2026,MCDONALDS RINGWOOD,-24.50
14/05/2026,WOOLWORTHS METRO,-56.80
15/05/2026,MORTGAGE PAYMENT,-2990.61
16/05/2026,HEALTH INSURANCE BUPA,-97.00
17/05/2026,AMAZON.COM,-200.00
18/05/2026,CHILDCARE MONTHLY,-800.00
19/05/2026,PETROL BP CROYDON,-98.00
20/05/2026,EATING OUT PIZZA,-55.00
22/05/2026,SPOTIFY,-16.99
23/05/2026,APPLE.COM/BILL,-4.50
25/05/2026,ELECTRICITY AGL,-271.00
28/05/2026,INTERNET AUSSIE BB,-129.00
29/05/2026,VET CROYDON ANIMAL,-220.00
30/05/2026,MISC SHOPS,-145.00`

function dropStyle(busy: boolean): CSSProperties {
  return {
    border: '1px dashed var(--border-md)',
    borderRadius: 'var(--r)',
    padding: '0.85rem',
    textAlign: 'center',
    cursor: busy ? 'wait' : 'pointer',
    background: 'var(--surface2)',
    opacity: busy ? 0.6 : 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    transition: 'background 0.15s',
  }
}

export default function ActualsClient({
  initialTxns, initialRules, initialSuggStatus, initialExpenses, initialUseActuals,
}: ActualsClientProps) {
  const [txnHistory,   setTxnHistory]   = useState<DbTxn[]>(initialTxns)
  const [pendingTxns,  setPendingTxns]  = useState<ParsedTransaction[]>([])
  const [customRules,  setCustomRules]  = useState<CustomRule[]>(initialRules)
  const [suggStatus,   setSuggStatus]   = useState<Record<string, SuggStatus>>(initialSuggStatus)
  const [expenses,     setExpenses]     = useState<ExpenseItem[]>(initialExpenses)
  const [csvText,      setCsvText]      = useState('')
  const [useActuals,   setUseActuals]   = useState(initialUseActuals)
  const [overriddenRows, setOverriddenRows] = useState<Record<number, string>>({})
  const [commitInfo,   setCommitInfo]   = useState<{ committed: number; skipped: number } | null>(null)
  const [pdfBusy,      setPdfBusy]      = useState(false)
  const [pdfStatus,    setPdfStatus]    = useState<string | null>(null)
  const bankInputRef = useRef<HTMLInputElement>(null)
  const cardInputRef = useRef<HTMLInputElement>(null)

  // ── Derived ──────────────────────────────────────────────────────────────
  const monthsCovered = useMemo(
    () => new Set(txnHistory.map(t => t.ym).filter(y => y !== 'unknown')),
    [txnHistory],
  )

  const catBudgetMonthly = useMemo(() => {
    const m: Record<string, number> = {}
    CATS.forEach(c => { m[c] = 0 })
    expenses.forEach(e => { m[e.cat] = (m[e.cat] ?? 0) + toMonthly(e.amt, e.freq) })
    return m
  }, [expenses])

  const totalBudgetMonthly = useMemo(
    () => Object.values(catBudgetMonthly).reduce((s, v) => s + v, 0),
    [catBudgetMonthly],
  )

  const avgs = useMemo(
    () => computeActualsAverages(txnHistory as unknown as ParsedTransaction[], monthsCovered),
    [txnHistory, monthsCovered],
  )

  const spendByMonth = useMemo(
    () => computeMonthlySpend(txnHistory as unknown as ParsedTransaction[]),
    [txnHistory],
  )

  const rawSuggestions = useMemo(
    () => buildSuggestions(txnHistory as unknown as ParsedTransaction[], monthsCovered, expenses),
    [txnHistory, monthsCovered, expenses],
  )

  const suggestions: Record<string, Suggestion> = useMemo(() => {
    const result: Record<string, Suggestion> = {}
    for (const [cat, s] of Object.entries(rawSuggestions)) {
      result[cat] = { ...s, status: suggStatus[cat] ?? 'pending' }
    }
    return result
  }, [rawSuggestions, suggStatus])

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  const parseCsv = useCallback(() => {
    if (!csvText.trim()) return
    const parsed = parseCsvText(csvText, customRules)
    setPendingTxns(parsed)
    setOverriddenRows({})
    setCommitInfo(null)
  }, [csvText, customRules])

  // ── Parse uploaded PDF statements ─────────────────────────────────────────
  const handlePdfs = useCallback(async (files: FileList | null, source: StatementSource) => {
    if (!files || !files.length) return
    setPdfBusy(true)
    setCommitInfo(null)
    const label = source === 'bank' ? 'bank statement' : 'credit card'
    setPdfStatus(`Reading ${files.length} ${label} PDF${files.length > 1 ? 's' : ''}…`)

    const collected: ParsedTransaction[] = []
    const errors: string[] = []
    for (const file of Array.from(files)) {
      try {
        const text = await extractPdfText(file)
        const parsed = parseStatementText(text, customRules, source)
        if (!parsed.length) errors.push(`${file.name}: no transactions detected`)
        collected.push(...parsed)
      } catch {
        errors.push(`${file.name}: couldn't read PDF`)
      }
    }
    if (collected.length) {
      setPendingTxns(prev => [...prev, ...collected])
      setOverriddenRows({})
    }
    setPdfBusy(false)
    const ok = `Added ${collected.length} transaction${collected.length === 1 ? '' : 's'} from ${files.length} file${files.length > 1 ? 's' : ''} — review below before committing.`
    setPdfStatus(errors.length ? `${ok} Issues: ${errors.join('; ')}.` : ok)
    if (source === 'bank' && bankInputRef.current) bankInputRef.current.value = ''
    if (source === 'card' && cardInputRef.current) cardInputRef.current.value = ''
  }, [customRules])

  // ── Commit to history ─────────────────────────────────────────────────────
  const commitTransactions = useCallback(async () => {
    const res = await fetch('/api/actuals/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingTxns),
    })
    const data = await res.json()
    setTxnHistory(data.transactions)
    setPendingTxns([])
    setOverriddenRows({})
    setCommitInfo({ committed: data.committed, skipped: data.skipped })
  }, [pendingTxns])

  // ── Clear history ─────────────────────────────────────────────────────────
  const clearHistory = useCallback(async () => {
    if (!confirm('Clear all transaction history? Custom rules are kept.')) return
    await fetch('/api/actuals/clear', { method: 'DELETE' })
    setTxnHistory([])
    setSuggStatus({})
    setCommitInfo(null)
  }, [])

  // ── Change category in pending ────────────────────────────────────────────
  const changePendingCat = useCallback((idx: number, newCat: string) => {
    setPendingTxns(prev => prev.map((t, i) => i === idx ? { ...t, cat: newCat, catSource: 'custom' } : t))
    setOverriddenRows(prev => ({ ...prev, [idx]: newCat }))
  }, [])

  // ── Save rule from review ─────────────────────────────────────────────────
  const saveRule = useCallback(async (idx: number) => {
    const txn    = pendingTxns[idx]
    const newCat = txn.cat
    const pattern = extractMerchantPattern(txn.desc)
    if (!pattern) return
    const res = await fetch('/api/actuals/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, cat: newCat }),
    })
    const rule: CustomRule = await res.json()
    setCustomRules(prev => {
      const existing = prev.find(r => r.id === rule.id)
      return existing ? prev.map(r => r.id === rule.id ? rule : r) : [...prev, rule]
    })
    // Re-categorise other pending that match the pattern
    setPendingTxns(prev => prev.map((t, i) => {
      if (i === idx) return t
      if (t.desc.toLowerCase().includes(pattern)) return { ...t, cat: newCat, catSource: 'custom' }
      return t
    }))
    setOverriddenRows(prev => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
  }, [pendingTxns])

  // ── Add / delete custom rule ──────────────────────────────────────────────
  const addRule = useCallback(async () => {
    const res = await fetch('/api/actuals/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'new pattern', cat: CATS[0] }),
    })
    const rule: CustomRule = await res.json()
    setCustomRules(prev => [...prev, rule])
  }, [])

  const updateRule = useCallback(async (id: number, field: string, value: string) => {
    setCustomRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    await fetch(`/api/actuals/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }, [])

  const deleteRule = useCallback(async (id: number) => {
    setCustomRules(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/actuals/rules/${id}`, { method: 'DELETE' })
  }, [])

  // ── Suggestions ───────────────────────────────────────────────────────────
  const acceptSuggestion = useCallback(async (cat: string) => {
    const s = suggestions[cat]
    if (!s) return
    const catTotal = catBudgetMonthly[cat] ?? 0
    const ratio = catTotal > 0 ? s.actual / catTotal : 1
    const updated = expenses.filter(e => e.cat === cat).map(e => ({
      ...e, amt: Math.round(e.amt * ratio * 100) / 100,
    }))
    setExpenses(prev => prev.map(e => { const u = updated.find(x => x.id === e.id); return u ?? e }))
    await Promise.all(updated.map(e => fetch(`/api/expenses/${e.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amt: e.amt }),
    })))
    setSuggStatus(prev => ({ ...prev, [cat]: 'accepted' }))
    await fetch(`/api/actuals/suggestions/${encodeURIComponent(cat)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted' }),
    })
  }, [suggestions, catBudgetMonthly, expenses])

  const dismissSuggestion = useCallback(async (cat: string) => {
    setSuggStatus(prev => ({ ...prev, [cat]: 'dismissed' }))
    await fetch(`/api/actuals/suggestions/${encodeURIComponent(cat)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    })
  }, [])

  const resetSuggestion = useCallback(async (cat: string) => {
    setSuggStatus(prev => ({ ...prev, [cat]: 'pending' }))
    await fetch(`/api/actuals/suggestions/${encodeURIComponent(cat)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    })
  }, [])

  // ── Use in projections toggle ─────────────────────────────────────────────
  const toggleUseActuals = useCallback(async (checked: boolean) => {
    setUseActuals(checked)
    await fetch('/api/actuals/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useActualsProjections: checked }),
    })
  }, [])

  // ── Coverage bar ──────────────────────────────────────────────────────────
  const coverageBar = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (23 - i), 1)
      const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      return { ym, label: d.toLocaleString('default', { month: 'short' }) }
    })
    const txnByMonth: Record<string, number> = {}
    txnHistory.forEach(t => { if (t.ym !== 'unknown') txnByMonth[t.ym] = (txnByMonth[t.ym] ?? 0) + 1 })
    return months.map(m => {
      const n = txnByMonth[m.ym] ?? 0
      return { ...m, cls: n > 10 ? 'covered' : n > 0 ? 'partial' : 'empty', n }
    })
  }, [txnHistory])

  const hasActuals = txnHistory.length > 0

  return (
    <div className="page">
      <div className="two-col">
        {/* ── LEFT column ─────────────────────────────────────────────────── */}
        <div>
          {/* Import */}
          <Panel
            title="Import bank / credit card data"
            dotColor="var(--teal)"
            right={
              <div style={{ display: 'flex', gap: 6 }}>
                {hasActuals && <span className="pill pill-teal">{txnHistory.length} transactions, {monthsCovered.size} months</span>}
                {hasActuals && <button className="action-btn sm ghost" onClick={clearHistory}>Clear history</button>}
              </div>
            }
          >
            {/* ── PDF upload: two boxes ── */}
            <p style={{ fontSize: '0.75rem', color: 'var(--t2)', marginBottom: '0.65rem' }}>
              Upload statement <strong>PDFs</strong> — the way banks actually send them. Drop in one or more files; transactions are parsed in your browser (nothing is uploaded) and added to the review list.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '0.8rem' }}>
              <div
                className="pdf-drop"
                onClick={() => !pdfBusy && bankInputRef.current?.click()}
                style={dropStyle(pdfBusy)}
              >
                <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>🏦 Bank statements</div>
                <div className="small" style={{ color: 'var(--t3)' }}>Everyday / savings accounts. Multiple PDFs OK.</div>
                <input
                  ref={bankInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  hidden
                  onChange={e => handlePdfs(e.target.files, 'bank')}
                />
              </div>
              <div
                className="pdf-drop"
                onClick={() => !pdfBusy && cardInputRef.current?.click()}
                style={dropStyle(pdfBusy)}
              >
                <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>💳 Credit cards</div>
                <div className="small" style={{ color: 'var(--t3)' }}>Where most spending sits. Multiple cards OK.</div>
                <input
                  ref={cardInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  hidden
                  onChange={e => handlePdfs(e.target.files, 'card')}
                />
              </div>
            </div>
            {pdfStatus && (
              <p className="small" style={{ marginBottom: '0.8rem', color: pdfBusy ? 'var(--t2)' : 'var(--green)' }}>
                {pdfBusy ? '⏳ ' : '✓ '}{pdfStatus}
              </p>
            )}

            <div style={{ borderTop: '1px solid var(--border)', margin: '0.2rem 0 0.8rem' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--t2)', marginBottom: '0.65rem' }}>
              Or paste CSV from any Australian bank. New imports are <strong>merged cumulatively</strong> — duplicates skipped. Format: date, description, amount.
            </p>
            <textarea
              className="csv-textarea"
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={'01/05/2026,WOOLWORTHS WARRANWOOD,-87.50\n02/05/2026,NETFLIX.COM,-22.99\n05/05/2026,SALARY CREDIT,9176.00'}
            />
            <div style={{ display: 'flex', gap: 7, marginTop: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="action-btn" onClick={parseCsv}>Parse &amp; merge</button>
              <button className="action-btn ghost" onClick={() => setCsvText(SAMPLE_CSV)}>Load sample</button>
              {commitInfo && (
                <span className="small">✓ {commitInfo.committed} committed{commitInfo.skipped > 0 ? `, ${commitInfo.skipped} skipped (duplicates)` : ''}</span>
              )}
            </div>
          </Panel>

          {/* Coverage */}
          <div style={{ marginTop: '1rem' }}>
            <Panel title="Data coverage — last 24 months" dotColor="var(--blue)">
              {!hasActuals ? (
                <p className="small" style={{ color: 'var(--t3)' }}>No data imported yet.</p>
              ) : (
                <>
                  <div className="month-coverage">
                    {coverageBar.map(m => (
                      <div key={m.ym} className={`month-dot ${m.cls}`} title={`${m.ym}: ${m.n} txns`}>{m.label}</div>
                    ))}
                  </div>
                  <p className="small">{monthsCovered.size} months covered, {txnHistory.length} total transactions</p>
                </>
              )}
            </Panel>
          </div>

          {/* Pending review */}
          {pendingTxns.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <Panel
                title="Review & recategorise"
                dotColor="var(--purple)"
                rawBody
                right={<span className="small">{pendingTxns.length} transactions, {pendingTxns.filter(t => t.catSource === 'custom').length} matched custom rules</span>}
              >
                <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
                  <table className="txn-table">
                    <thead><tr><th>Date</th><th>Description</th><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th><th>Source</th></tr></thead>
                    <tbody>
                      {pendingTxns.map((t, i) => (
                        <tr key={i}>
                          <td>{t.dateStr}</td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.desc}>{t.desc}</td>
                          <td>
                            <select
                              value={t.cat}
                              onChange={e => changePendingCat(i, e.target.value)}
                              style={{ fontSize: '0.74rem', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 4px', background: 'var(--surface)' }}
                            >
                              {[...CATS, 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {overriddenRows[i] !== undefined && (
                              <span className="remember-prompt" onClick={() => saveRule(i)}>Save rule</span>
                            )}
                          </td>
                          <td className={t.amt < 0 ? 'amt-neg' : 'amt-pos'}>
                            {t.amt < 0 ? '-' : ''}${Math.abs(t.amt).toFixed(2)}
                          </td>
                          <td>
                            {t.lumpy && <span className="pill pill-amber" style={{ marginRight: 4 }}>Lumpy</span>}
                            {t.catSource === 'custom'
                              ? <span className="rule-source-custom">✓ Custom</span>
                              : <span className="rule-source-sys">Auto</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '0.6rem 1.2rem', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="action-btn green" onClick={commitTransactions}>✓ Commit to history</button>
                  <span className="small">Commits merge into running history and rebuild suggestions</span>
                </div>
              </Panel>
            </div>
          )}

          {/* Custom rules */}
          <div style={{ marginTop: '1rem' }}>
            <Panel
              title="Learned categorisation rules"
              dotColor="var(--teal)"
              right={<span className="small">{customRules.length} rule{customRules.length !== 1 ? 's' : ''}</span>}
            >
              <p style={{ fontSize: '0.74rem', color: 'var(--t2)', marginBottom: '0.75rem' }}>
                Custom rules run before built-in keywords. Correct a category during review then click <strong>Save rule</strong> to remember it.
              </p>
              <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
                <table className="rule-table">
                  <thead><tr><th>Pattern (contains)</th><th>Category</th><th>Source</th><th>Hits</th><th /></tr></thead>
                  <tbody>
                    {customRules.map(r => (
                      <tr key={r.id}>
                        <td>
                          <input
                            defaultValue={r.pattern}
                            onBlur={e => updateRule(r.id, 'pattern', e.target.value)}
                            style={{ border: 'none', background: 'transparent', width: '100%', fontFamily: 'monospace', fontSize: '0.74rem' }}
                          />
                        </td>
                        <td>
                          <select
                            value={r.cat}
                            onChange={e => updateRule(r.id, 'cat', e.target.value)}
                            style={{ fontSize: '0.74rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                          >
                            {[...CATS, 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td><span className={r.source === 'user' ? 'rule-source-custom' : 'rule-source-sys'}>{r.source === 'user' ? 'Custom' : 'Built-in'}</span></td>
                        <td style={{ color: 'var(--t3)', fontSize: '0.72rem' }}>{r.hits}</td>
                        <td><button className="del-btn" onClick={() => deleteRule(r.id)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="add-btn mt1" onClick={addRule}>+ Add rule manually</button>
            </Panel>
          </div>
        </div>

        {/* ── RIGHT column ─────────────────────────────────────────────────── */}
        <div>
          {/* Suggestions */}
          <Panel
            title="Budget update suggestions"
            dotColor="var(--amber)"
            right={
              <label className="proj-toggle">
                <span>Use in projections</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={useActuals} onChange={e => toggleUseActuals(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </label>
            }
          >
            {!Object.keys(suggestions).length ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--t3)', textAlign: 'center', padding: '1.5rem 0' }}>Import 2+ months of data to see suggestions</p>
            ) : (() => {
              const cats       = CATS.filter(c => suggestions[c])
              const pending    = cats.filter(c => { const s = suggestions[c]; return s.hasData && s.significant && s.status === 'pending' })
              const insufficient = cats.filter(c => !suggestions[c].hasData)
              const settled    = cats.filter(c => { const s = suggestions[c]; return s.status === 'accepted' || s.status === 'dismissed' })

              return (
                <>
                  {pending.length > 0 && (
                    <>
                      <div style={{ fontSize: '0.68rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t2)', marginBottom: '0.5rem' }}>Suggested updates</div>
                      {pending.map(cat => {
                        const s = suggestions[cat]
                        const over = s.diff > 0
                        const pctStr = (over ? '+' : '') + Math.round(s.pctDiff * 100) + '%'
                        return (
                          <div key={cat} className="suggestion-card pending">
                            <div className="sug-header">
                              <span className="sug-cat">{cat}</span>
                              <span className={`sug-diff ${over ? 'over' : 'under'}`}>{pctStr} {over ? 'over' : 'under'} budget</span>
                            </div>
                            <div className="sug-body">
                              <div className="sug-num"><div className="sug-num-label">Budget</div><div className="sug-num-val">{fmt(s.budgeted)}/mo</div></div>
                              <span className="sug-arrow">→</span>
                              <div className="sug-num"><div className="sug-num-label">Actual avg ({s.months}mo)</div><div className="sug-num-val" style={{ color: over ? 'var(--red)' : 'var(--green)' }}>{fmt(s.actual)}/mo</div></div>
                              <div className="sug-num"><div className="sug-num-label">Diff</div><div className="sug-num-val" style={{ color: over ? 'var(--red)' : 'var(--green)' }}>{over ? '+' : ''}{fmt(s.diff)}/mo</div></div>
                            </div>
                            <div className="sug-note">Accepting scales all {cat} line items proportionally. Annual impact: {over ? '+' : ''}{fmt(s.diff * 12)}.</div>
                            <div className="sug-actions mt1">
                              <button className="action-btn sm green" onClick={() => acceptSuggestion(cat)}>✓ Accept</button>
                              <button className="action-btn sm ghost" onClick={() => dismissSuggestion(cat)}>Dismiss</button>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                  {insufficient.length > 0 && (
                    <>
                      <div style={{ fontSize: '0.68rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t3)', margin: '0.75rem 0 0.5rem' }}>Needs more data</div>
                      {insufficient.map(cat => {
                        const s = suggestions[cat]
                        return (
                          <div key={cat} className="suggestion-card insufficient">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="sug-cat" style={{ color: 'var(--t2)' }}>{cat}</span>
                              <span className="small">{s.months}/{s.needed} months</span>
                            </div>
                            <div className="sug-note">Need {s.needed - s.months} more months.</div>
                          </div>
                        )
                      })}
                    </>
                  )}
                  {settled.length > 0 && (
                    <>
                      <div style={{ fontSize: '0.68rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t3)', margin: '0.75rem 0 0.5rem' }}>Resolved</div>
                      {settled.map(cat => {
                        const s = suggestions[cat]
                        return (
                          <div key={cat} className={`suggestion-card ${s.status}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="sug-cat">{cat}</span>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span className={`pill ${s.status === 'accepted' ? 'pill-green' : 'pill-grey'}`}>{s.status === 'accepted' ? '✓ Accepted' : 'Dismissed'}</span>
                                <button className="action-btn sm ghost" onClick={() => resetSuggestion(cat)}>Reset</button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                  {pending.length === 0 && insufficient.length === 0 && settled.length === 0 && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--t3)', textAlign: 'center', padding: '1rem 0' }}>No significant differences detected yet.</p>
                  )}
                </>
              )
            })()}
          </Panel>

          {/* Variance */}
          <div style={{ marginTop: '1rem' }}>
            <Panel title="Actual vs budget" dotColor="var(--green)">
              {!Object.keys(avgs).length ? (
                <p className="small" style={{ color: 'var(--t3)', textAlign: 'center', padding: '1rem 0' }}>No actuals data yet</p>
              ) : (
                <div>
                  {CATS.filter(cat => (catBudgetMonthly[cat] ?? 0) > 0 || (avgs[cat] ?? 0) > 0).map(cat => {
                    const budgeted = catBudgetMonthly[cat] ?? 0
                    const actual   = avgs[cat] ?? 0
                    const diff     = actual - budgeted
                    const over     = diff > 0
                    const pct      = budgeted > 0 ? Math.min(actual / budgeted, 2) : 0
                    return (
                      <div key={cat} className="variance-row">
                        <span style={{ minWidth: 95, color: 'var(--t2)' }}>{cat}</span>
                        <div className="var-bar-wrap">
                          <div className="var-bar" style={{ width: `${Math.min(pct * 100, 100)}%`, background: over ? 'var(--red)' : 'var(--green)' }} />
                        </div>
                        <span style={{ minWidth: 60, textAlign: 'right', color: 'var(--t3)', fontSize: '0.72rem' }}>{fmt(budgeted)} bdg</span>
                        <span style={{ minWidth: 65, textAlign: 'right', fontWeight: 500, color: over ? 'var(--red)' : 'var(--green)' }}>{fmt(actual)} act</span>
                        <span style={{ minWidth: 55, textAlign: 'right', fontSize: '0.72rem', color: over ? 'var(--red)' : 'var(--green)' }}>{over ? '+' : ''}{fmtS(diff)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* Spend history */}
          <div style={{ marginTop: '1rem' }}>
            <Panel title="Monthly spend history" dotColor="var(--blue)">
              <SpendHistoryChart spendByMonth={spendByMonth} budgetMonthly={totalBudgetMonthly} />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
