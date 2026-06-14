'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { computeMonthlyRepayment, monthsUntil } from '@/lib/mortgage'
import { fmt } from '@/lib/formatting'

interface FormState {
  person1Name:        string
  person1Age:         string
  person1Income:      string
  person1HasHELP:     boolean
  person1HELPBalance: string
  person1Days:        number
  hasPartner:         boolean
  person2Name:        string
  person2Age:         string
  person2Income:      string
  person2HasHELP:     boolean
  person2HELPBalance: string
  person2Days:        number
  person1Super:       string
  person2Super:       string
  cashBalance:        string
  sharesValue:        string
  cryptoValue:        string
  otherInvestments:   string
  hasMortgage:        boolean
  mortgageBalance:    string
  mortgageRate:       string
  mortgageEndDate:    string
  hasParentalLeave:   boolean
}

// Suggested median values — sourced from ABS / ATO Australian data.
// Displayed as explicit chips the user must click to accept; never silently pre-filled.
const SUGGEST = {
  age1:          { display: '35 years',   value: '35',     note: 'Median Australian worker' },
  age2:          { display: '33 years',   value: '33',     note: 'Median Australian partner' },
  income:        { display: '$100,000',   value: '100000', note: 'Median FTE salary (ABS)' },
  helpBalance:   { display: '$26,000',    value: '26000',  note: 'Median HELP debt (ATO)' },
  super1:        { display: '$75,000',    value: '75000',  note: 'Median super balance 35–44 (ABS)' },
  super2:        { display: '$60,000',    value: '60000',  note: 'Median super balance 35–44 (ABS)' },
  cash:          { display: '$25,000',    value: '25000',  note: 'Median household savings (ABS)' },
  mortgageBal:   { display: '$620,000',   value: '620000', note: 'Median Australian mortgage (ABS)' },
  mortgageRate:  { display: '6.2%',       value: '6.20',   note: 'Average variable rate (RBA)' },
}

const STEP_LABELS = ['About you', 'Your partner', 'Superannuation', 'Investments', 'Cash & mortgage']

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="ob-field">
      <div className="ob-field-label">{label}</div>
      {hint && <div className="ob-field-hint">{hint}</div>}
      {children}
    </div>
  )
}

// Chip shown only when field is empty — user must click to accept the suggested value.
function SuggestChip({ suggest, onAccept }: {
  suggest: { display: string; note: string }
  onAccept: () => void
}) {
  return (
    <button type="button" className="ob-suggest" onClick={onAccept}>
      <span className="ob-suggest-label">Suggested</span>
      <span className="ob-suggest-value">{suggest.display}</span>
      <span className="ob-suggest-note">{suggest.note}</span>
    </button>
  )
}

function MoneyInput({ value, onChange, placeholder, suggest, onAcceptSuggest }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suggest?: { display: string; note: string }
  onAcceptSuggest?: () => void
}) {
  return (
    <div>
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
      {suggest && onAcceptSuggest && !value && (
        <SuggestChip suggest={suggest} onAccept={onAcceptSuggest} />
      )}
    </div>
  )
}

function AgeInput({ value, onChange, suggest, onAcceptSuggest }: {
  value: string
  onChange: (v: string) => void
  suggest: { display: string; note: string }
  onAcceptSuggest: () => void
}) {
  return (
    <div>
      <input
        className="ob-input"
        type="number"
        min="18"
        max="100"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {!value && <SuggestChip suggest={suggest} onAccept={onAcceptSuggest} />}
    </div>
  )
}

function DaysInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="ob-binary" style={{ gap: 4 }}>
      {[1, 2, 3, 4, 5].map(d => (
        <button
          key={d}
          type="button"
          className={`ob-binary-opt${value === d ? ' active' : ''}`}
          onClick={() => onChange(d)}
          style={{ minWidth: 40 }}
        >
          {d}
        </button>
      ))}
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
    person1HasHELP: false, person1HELPBalance: '', person1Days: 5,
    hasPartner: false,
    person2Name: '', person2Age: '', person2Income: '',
    person2HasHELP: false, person2HELPBalance: '', person2Days: 5,
    person1Super: '', person2Super: '',
    sharesValue: '', cryptoValue: '', otherInvestments: '',
    cashBalance: '',
    hasMortgage: false,
    mortgageBalance: '', mortgageRate: '', mortgageEndDate: '',
    hasParentalLeave: false,
  })

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }))

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!form.person1Name.trim() && parseFloat(form.person1Age) > 0 && parseFloat(form.person1Income) > 0
      case 2: return !form.hasPartner || (!!form.person2Name.trim() && parseFloat(form.person2Age) > 0 && parseFloat(form.person2Income) > 0)
      case 3: return form.person1Super !== ''
      case 4: return true
      case 5: return form.cashBalance !== ''
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
          person1Age:         parseFloat(form.person1Age)         || 0,
          person1Income:      parseFloat(form.person1Income)      || 0,
          person1HasHELP:     form.person1HasHELP,
          person1HELPBalance: parseFloat(form.person1HELPBalance) || 0,
          person1Days:        form.person1Days,
          hasPartner:         form.hasPartner,
          person2Name:        form.person2Name.trim() || 'Partner',
          person2Age:         parseFloat(form.person2Age)         || 0,
          person2Income:      parseFloat(form.person2Income)      || 0,
          person2HasHELP:     form.person2HasHELP,
          person2HELPBalance: parseFloat(form.person2HELPBalance) || 0,
          person2Days:        form.person2Days,
          person1Super:       parseFloat(form.person1Super)       || 0,
          person2Super:       parseFloat(form.person2Super)       || 0,
          sharesValue:        parseFloat(form.sharesValue)        || 0,
          cryptoValue:        parseFloat(form.cryptoValue)        || 0,
          otherInvestments:   parseFloat(form.otherInvestments)   || 0,
          cashBalance:        parseFloat(form.cashBalance)        || 0,
          hasMortgage:        form.hasMortgage,
          mortgageBalance:    parseFloat(form.mortgageBalance)    || 0,
          mortgageRate:       parseFloat(form.mortgageRate)       || 0,
          mortgageEndDate:    form.mortgageEndDate,
          hasParentalLeave:   form.hasParentalLeave,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setStep(6)
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

  // ── Done (step 6) ─────────────────────────────────────────────────────────
  if (step === 6) {
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

  // ── Form steps 1–5 ────────────────────────────────────────────────────────
  const isLast = step === 5
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
                  placeholder="e.g. Alex"
                  autoFocus
                />
              </Field>
              <Field label="Your age">
                <AgeInput
                  value={form.person1Age}
                  onChange={v => set({ person1Age: v })}
                  suggest={SUGGEST.age1}
                  onAcceptSuggest={() => set({ person1Age: SUGGEST.age1.value })}
                />
              </Field>
              <Field label="Gross salary / year" hint="Before tax, excluding super">
                <MoneyInput
                  value={form.person1Income}
                  onChange={v => set({ person1Income: v })}
                  suggest={SUGGEST.income}
                  onAcceptSuggest={() => set({ person1Income: SUGGEST.income.value })}
                />
              </Field>
              <Field label="Days per week" hint="How many days per week are you currently working?">
                <DaysInput value={form.person1Days} onChange={v => set({ person1Days: v })} />
              </Field>
              <div className="ob-toggle-row">
                <div>
                  <div className="ob-field-label">HELP / HECS debt</div>
                  <div className="ob-field-hint">Do you have a student loan?</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.person1HasHELP}
                    onChange={e => set({ person1HasHELP: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
              {form.person1HasHELP && (
                <Field label="Your HELP balance">
                  <MoneyInput
                    value={form.person1HELPBalance}
                    onChange={v => set({ person1HELPBalance: v })}
                    suggest={SUGGEST.helpBalance}
                    onAcceptSuggest={() => set({ person1HELPBalance: SUGGEST.helpBalance.value })}
                  />
                </Field>
              )}
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
                      placeholder="e.g. Jordan"
                      autoFocus
                    />
                  </Field>
                  <Field label="Partner's age">
                    <AgeInput
                      value={form.person2Age}
                      onChange={v => set({ person2Age: v })}
                      suggest={SUGGEST.age2}
                      onAcceptSuggest={() => set({ person2Age: SUGGEST.age2.value })}
                    />
                  </Field>
                  <Field label="Partner's gross salary / year" hint="FTE — if part-time, enter the full-time equivalent">
                    <MoneyInput
                      value={form.person2Income}
                      onChange={v => set({ person2Income: v })}
                      suggest={SUGGEST.income}
                      onAcceptSuggest={() => set({ person2Income: SUGGEST.income.value })}
                    />
                  </Field>
                  <Field label="Partner's days per week" hint="How many days per week is your partner currently working?">
                    <DaysInput value={form.person2Days} onChange={v => set({ person2Days: v })} />
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
                    <Field label="Partner's HELP balance">
                      <MoneyInput
                        value={form.person2HELPBalance}
                        onChange={v => set({ person2HELPBalance: v })}
                        suggest={SUGGEST.helpBalance}
                        onAcceptSuggest={() => set({ person2HELPBalance: SUGGEST.helpBalance.value })}
                      />
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
                <MoneyInput
                  value={form.person1Super}
                  onChange={v => set({ person1Super: v })}
                  suggest={SUGGEST.super1}
                  onAcceptSuggest={() => set({ person1Super: SUGGEST.super1.value })}
                />
              </Field>
              {form.hasPartner && (
                <Field label={`${p2}'s super balance`}>
                  <MoneyInput
                    value={form.person2Super}
                    onChange={v => set({ person2Super: v })}
                    suggest={SUGGEST.super2}
                    onAcceptSuggest={() => set({ person2Super: SUGGEST.super2.value })}
                  />
                </Field>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4: Investments ── */}
        {step === 4 && (
          <div>
            <div className="ob-step-title">Investments & holdings</div>
            <p className="ob-step-sub">Approximately — you can adjust these later in the Debts & Assets tab.</p>
            <div className="ob-fields">
              <Field label="Shares & ETFs" hint="Total value across all brokerage accounts">
                <MoneyInput value={form.sharesValue} onChange={v => set({ sharesValue: v })} placeholder="0" />
              </Field>
              <Field label="Cryptocurrency" hint="Total value in today's prices">
                <MoneyInput value={form.cryptoValue} onChange={v => set({ cryptoValue: v })} placeholder="0" />
              </Field>
              <Field label="Other investments" hint="Managed funds, bonds, investment property equity, etc.">
                <MoneyInput value={form.otherInvestments} onChange={v => set({ otherInvestments: v })} placeholder="0" />
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 5: Cash & mortgage ── */}
        {step === 5 && (
          <div>
            <div className="ob-step-title">Cash & mortgage</div>
            <div className="ob-fields">
              <Field label="Cash & savings" hint="Total across all bank accounts">
                <MoneyInput
                  value={form.cashBalance}
                  onChange={v => set({ cashBalance: v })}
                  suggest={SUGGEST.cash}
                  onAcceptSuggest={() => set({ cashBalance: SUGGEST.cash.value })}
                />
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
                    <MoneyInput
                      value={form.mortgageBalance}
                      onChange={v => set({ mortgageBalance: v })}
                      suggest={SUGGEST.mortgageBal}
                      onAcceptSuggest={() => set({ mortgageBalance: SUGGEST.mortgageBal.value })}
                    />
                  </Field>
                  <Field label="Interest rate (% p.a.)">
                    <div>
                      <input
                        className="ob-input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.mortgageRate}
                        onChange={e => set({ mortgageRate: e.target.value })}
                      />
                      {!form.mortgageRate && (
                        <SuggestChip
                          suggest={SUGGEST.mortgageRate}
                          onAccept={() => set({ mortgageRate: SUGGEST.mortgageRate.value })}
                        />
                      )}
                    </div>
                  </Field>
                  <Field label="Loan end date" hint="When is the loan due to be paid off? We'll work out the repayment.">
                    <input
                      className="ob-input"
                      type="date"
                      value={form.mortgageEndDate}
                      onChange={e => set({ mortgageEndDate: e.target.value })}
                    />
                  </Field>
                  {(() => {
                    const repayment = computeMonthlyRepayment(
                      parseFloat(form.mortgageBalance) || 0,
                      parseFloat(form.mortgageRate) || 0,
                      monthsUntil(form.mortgageEndDate),
                    )
                    return repayment > 0 ? (
                      <div className="ob-field-hint" style={{ marginTop: -4 }}>
                        Estimated repayment: <strong>{fmt(repayment)}/month</strong>
                      </div>
                    ) : null
                  })()}
                </>
              )}

              <div className="ob-toggle-row">
                <div>
                  <div className="ob-field-label">Parental leave</div>
                  <div className="ob-field-hint">Will either person take parental leave during the projection period?</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.hasParentalLeave}
                    onChange={e => set({ hasParentalLeave: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

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
