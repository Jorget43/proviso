'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface FormState {
  person1Name:       string
  person1Age:        string
  person1Income:     string
  hasPartner:        boolean
  person2Name:       string
  person2Age:        string
  person2Income:     string
  person2HasHELP:    boolean
  person2HELPBalance:string
  person1Super:      string
  person2Super:      string
  cashBalance:       string
  hasMortgage:       boolean
  mortgageBalance:   string
  mortgageRate:      string
  mortgagePayment:   string
}

const STEP_LABELS = ['About you', 'Your partner', 'Superannuation', 'Cash & mortgage']

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="ob-field">
      <div className="ob-field-label">{label}</div>
      {hint && <div className="ob-field-hint">{hint}</div>}
      {children}
    </div>
  )
}

function MoneyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="ob-prefix-row">
      <span className="ob-prefix-sym">$</span>
      <input
        className="ob-prefix-input"
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

export default function OnboardingClient() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>({
    person1Name: '', person1Age: '', person1Income: '',
    hasPartner: true,
    person2Name: '', person2Age: '', person2Income: '',
    person2HasHELP: false, person2HELPBalance: '',
    person1Super: '', person2Super: '',
    cashBalance: '',
    hasMortgage: true,
    mortgageBalance: '', mortgageRate: '', mortgagePayment: '',
  })

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }))

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!form.person1Name.trim() && parseFloat(form.person1Age) > 0 && parseFloat(form.person1Income) > 0
      case 2: return !form.hasPartner || (!!form.person2Name.trim() && parseFloat(form.person2Age) > 0 && parseFloat(form.person2Income) > 0)
      case 3: return form.person1Super !== ''
      case 4: return form.cashBalance !== ''
      default: return true
    }
  }

  const next = () => { setError(''); setStep(s => s + 1) }
  const back = () => { setError(''); setStep(s => s - 1) }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person1Name:        form.person1Name.trim(),
          person1Age:         parseFloat(form.person1Age)        || 0,
          person1Income:      parseFloat(form.person1Income)     || 0,
          hasPartner:         form.hasPartner,
          person2Name:        form.person2Name.trim() || 'Partner',
          person2Age:         parseFloat(form.person2Age)        || 0,
          person2Income:      parseFloat(form.person2Income)     || 0,
          person2HasHELP:     form.person2HasHELP,
          person2HELPBalance: parseFloat(form.person2HELPBalance)|| 0,
          person1Super:       parseFloat(form.person1Super)      || 0,
          person2Super:       parseFloat(form.person2Super)      || 0,
          cashBalance:        parseFloat(form.cashBalance)       || 0,
          hasMortgage:        form.hasMortgage,
          mortgageBalance:    parseFloat(form.mortgageBalance)   || 0,
          mortgageRate:       parseFloat(form.mortgageRate)      || 0,
          mortgagePayment:    parseFloat(form.mortgagePayment)   || 0,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setStep(5)
      setTimeout(() => router.push('/budget'), 1800)
    } catch {
      setError('Something went wrong — please try again.')
      setSubmitting(false)
    }
  }

  // ── Welcome (step 0) ──────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="ob-outer">
        <div className="ob-card">
          <div className="ob-welcome">
            <div className="ob-logo">Proviso</div>
            <div className="ob-welcome-headline">Your household,<br />modelled.</div>
            <p className="ob-welcome-sub">
              Most apps tell you what you spent yesterday.<br />
              This one models what you&rsquo;ll be worth tomorrow.
            </p>
            <p className="ob-welcome-sub ob-welcome-sub-sm">Takes about 2 minutes to set up.</p>
            <button className="ob-btn-primary" onClick={next}>
              Get started →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Done (step 5) ─────────────────────────────────────────────────────────
  if (step === 5) {
    return (
      <div className="ob-outer">
        <div className="ob-card">
          <div className="ob-done">
            <div className="ob-done-check">✓</div>
            <div className="ob-done-title">You&rsquo;re all set!</div>
            <p className="ob-done-sub">
              Your dashboard is ready.<br />Taking you to Budget now…
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Form steps 1–4 ────────────────────────────────────────────────────────
  const isLast = step === 4
  const p1 = form.person1Name || 'You'
  const p2 = form.person2Name || 'Partner'

  return (
    <div className="ob-outer">
      <div className="ob-card">
        {/* Progress */}
        <div className="ob-progress">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className={`ob-dot${i + 1 === step ? ' active' : i + 1 < step ? ' done' : ''}`}
            />
          ))}
        </div>

        {/* ── Step 1: About you ── */}
        {step === 1 && (
          <div>
            <div className="ob-step-title">About you</div>
            <div className="ob-fields">
              <Field label="Your first name">
                <input
                  className="ob-input"
                  value={form.person1Name}
                  onChange={e => set({ person1Name: e.target.value })}
                  placeholder="e.g. Person1"
                  autoFocus
                />
              </Field>
              <Field label="Your age">
                <input
                  className="ob-input"
                  type="number"
                  min="18"
                  max="100"
                  value={form.person1Age}
                  onChange={e => set({ person1Age: e.target.value })}
                  placeholder="34"
                />
              </Field>
              <Field label="Gross salary / year" hint="Before tax, excluding super">
                <MoneyInput value={form.person1Income} onChange={v => set({ person1Income: v })} placeholder="150000" />
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 2: Partner ── */}
        {step === 2 && (
          <div>
            <div className="ob-step-title">Your partner</div>
            <div className="ob-fields">
              <Field label="Do you have a partner?">
                <div className="ob-binary">
                  <button
                    type="button"
                    className={`ob-binary-opt${!form.hasPartner ? ' active' : ''}`}
                    onClick={() => set({ hasPartner: false })}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`ob-binary-opt${form.hasPartner ? ' active' : ''}`}
                    onClick={() => set({ hasPartner: true })}
                  >
                    Yes
                  </button>
                </div>
              </Field>

              {form.hasPartner && (
                <>
                  <Field label="Partner's first name">
                    <input
                      className="ob-input"
                      value={form.person2Name}
                      onChange={e => set({ person2Name: e.target.value })}
                      placeholder="e.g. Person2"
                      autoFocus
                    />
                  </Field>
                  <Field label="Partner's age">
                    <input
                      className="ob-input"
                      type="number"
                      min="18"
                      max="100"
                      value={form.person2Age}
                      onChange={e => set({ person2Age: e.target.value })}
                      placeholder="32"
                    />
                  </Field>
                  <Field label="Partner's gross salary / year" hint="FTE — if part-time, enter the full-time equivalent">
                    <MoneyInput value={form.person2Income} onChange={v => set({ person2Income: v })} placeholder="100000" />
                  </Field>
                  <div className="ob-toggle-row">
                    <div>
                      <div className="ob-field-label">HELP / HECS debt</div>
                      <div className="ob-field-hint">Does your partner have a student loan?</div>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={form.person2HasHELP}
                        onChange={e => set({ person2HasHELP: e.target.checked })}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  {form.person2HasHELP && (
                    <Field label="HELP balance">
                      <MoneyInput value={form.person2HELPBalance} onChange={v => set({ person2HELPBalance: v })} placeholder="60000" />
                    </Field>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Super ── */}
        {step === 3 && (
          <div>
            <div className="ob-step-title">Superannuation</div>
            <p className="ob-step-sub">Check your latest super fund statement or app.</p>
            <div className="ob-fields">
              <Field label={`${p1}'s super balance`}>
                <MoneyInput value={form.person1Super} onChange={v => set({ person1Super: v })} placeholder="164000" />
              </Field>
              {form.hasPartner && (
                <Field label={`${p2}'s super balance`}>
                  <MoneyInput value={form.person2Super} onChange={v => set({ person2Super: v })} placeholder="80000" />
                </Field>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4: Cash & mortgage ── */}
        {step === 4 && (
          <div>
            <div className="ob-step-title">Cash & mortgage</div>
            <div className="ob-fields">
              <Field label="Cash & savings" hint="Total across all bank accounts">
                <MoneyInput value={form.cashBalance} onChange={v => set({ cashBalance: v })} placeholder="52700" />
              </Field>

              <div className="ob-toggle-row">
                <div>
                  <div className="ob-field-label">Home loan</div>
                  <div className="ob-field-hint">Do you have a mortgage?</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.hasMortgage}
                    onChange={e => set({ hasMortgage: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {form.hasMortgage && (
                <>
                  <Field label="Outstanding balance">
                    <MoneyInput value={form.mortgageBalance} onChange={v => set({ mortgageBalance: v })} placeholder="530000" />
                  </Field>
                  <Field label="Interest rate (% p.a.)">
                    <input
                      className="ob-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.mortgageRate}
                      onChange={e => set({ mortgageRate: e.target.value })}
                      placeholder="5.99"
                    />
                  </Field>
                  <Field label="Monthly repayment">
                    <MoneyInput value={form.mortgagePayment} onChange={v => set({ mortgagePayment: v })} placeholder="3237" />
                  </Field>
                </>
              )}

              {error && <div className="ob-error">{error}</div>}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="ob-nav">
          <button className="ob-btn-back" type="button" onClick={back}>
            ← Back
          </button>
          {isLast ? (
            <button
              className="ob-btn-primary"
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed() || submitting}
            >
              {submitting ? 'Saving…' : 'Finish →'}
            </button>
          ) : (
            <button
              className="ob-btn-primary"
              type="button"
              onClick={next}
              disabled={!canProceed()}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
