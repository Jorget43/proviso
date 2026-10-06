// Setting up a new household: a few questions, then a first budget of typical
// costs for a household like theirs, to adjust before saving. The estimates
// and the rows they become live in @proviso/core/starter; this screen only asks.

import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import {
  STATES, TYPICAL, typicalSuper, typicalWeeklyRent, typicalChildcareDay, estimateLivingCosts, buildStarterHousehold,
  isPreschool, type StarterAnswers, type StarterLine, type StarterPerson, type StateKey, type HomeKind,
} from '@proviso/core/starter'
import type { SchoolType } from '@proviso/core/educationCosts'
import { computeBudgetSummary } from '@proviso/core/budgetSummary'
import { CATS } from '@proviso/core/constants'
import { fmt, toMonthly } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { startHousehold } from '@/data/setup'
import { Button, Card, Choice, Field, H2, NumberField, Screen, T, TextField, parseAmount, useInputStyle } from '@/ui/kit'
import { usePalette, space, radius, touch } from '@/ui/theme'

const STEPS = ['where', 'you', 'partner', 'kids', 'home', 'money', 'review'] as const
type Step = typeof STEPS[number]

interface PersonForm { name: string; age: string; salary: string; days: string; hasHelp: boolean; help: string; super: string }
const blankPerson = (): PersonForm => ({ name: '', age: '', salary: '', days: '5', hasHelp: false, help: '', super: '' })

interface ChildForm { age: string; care: string }

const DAYS = [{ key: '0', label: 'None' }, ...[1, 2, 3, 4, 5].map(d => ({ key: String(d), label: String(d) }))]
const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]
const FREQ_LABEL: Record<string, string> = { weekly: 'a week', monthly: 'a month', quarterly: 'a quarter', yearly: 'a year' }

const num = (s: string) => { const n = parseAmount(s); return Number.isFinite(n) ? n : 0 }
const validAge = (s: string, min: number, max: number) => { const n = parseAmount(s); return Number.isInteger(n) && n >= min && n <= max }

export default function Setup() {
  const { household, change } = useHousehold()
  const [step, setStep] = useState<Step>('where')
  const [state, setState] = useState<StateKey | null>(null)
  const [regional, setRegional] = useState<boolean | null>(null)
  const [you, setYou] = useState<PersonForm>(blankPerson)
  const [hasPartner, setHasPartner] = useState<boolean | null>(null)
  const [partner, setPartner] = useState<PersonForm>(blankPerson)
  const [kids, setKids] = useState<ChildForm[]>([])
  const [schoolType, setSchoolType] = useState<SchoolType>('government')
  const [home, setHome] = useState<HomeKind | null>(null)
  const [rent, setRent] = useState('')
  const [loan, setLoan] = useState({ balance: '', rate: '', years: '' })
  const [cars, setCars] = useState<string | null>(null)
  const [cash, setCash] = useState('')
  const [investments, setInvestments] = useState('')
  // Review: changes to the estimates, by line key, kept if the answers change.
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const split = STATES.find(s => s.key === state)?.split ?? false
  const at = STEPS.indexOf(step)

  const person = (f: PersonForm): StarterPerson => ({
    name: f.name.trim(), age: num(f.age), salary: Number(f.days) > 0 ? num(f.salary) : 0, days: Number(f.days),
    hasHelp: f.hasHelp, helpBalance: f.hasHelp ? num(f.help) : 0, superBalance: num(f.super),
  })

  const answers = (): StarterAnswers => ({
    state: state ?? 'nsw', regional: split && regional === true,
    you: person(you), partner: hasPartner ? person(partner) : null,
    children: kids.map(k => ({ age: num(k.age), childcareDays: num(k.age) < 5 ? Number(k.care) : 0 })),
    schoolType: kids.length ? schoolType : null,
    home: {
      kind: home ?? 'other', weeklyRent: num(rent),
      mortgageBalance: num(loan.balance), mortgageRate: num(loan.rate), mortgageYears: num(loan.years),
    },
    cars: cars === null ? 0 : Number(cars), cash: num(cash), investments: num(investments),
  })

  const personOk = (f: PersonForm) => f.name.trim() !== '' && validAge(f.age, 16, 100)
    && (Number(f.days) === 0 || num(f.salary) > 0) && (!f.hasHelp || num(f.help) > 0)
  const ready: Record<Step, boolean> = {
    where:   state !== null && (!split || regional !== null),
    you:     personOk(you),
    partner: hasPartner === false || (hasPartner === true && personOk(partner)),
    kids:    kids.every(k => validAge(k.age, 0, 17)),
    home:    home !== null && cars !== null
      && (home !== 'rent' || num(rent) > 0)
      && (home !== 'mortgage' || (num(loan.balance) > 0 && num(loan.rate) > 0 && num(loan.years) > 0)),
    money:   true,
    review:  true,
  }

  const go = (d: 1 | -1) => {
    setError(null)
    if (d === -1 && at === 0) { router.back(); return }
    setStep(STEPS[at + d])
  }

  async function finish(lines: StarterLine[]) {
    setSaving(true)
    try {
      const plan = buildStarterHousehold(answers(), lines, new Date())
      await change(db => startHousehold(db, plan))
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving that.')
      setSaving(false)
    }
  }

  return (
    <Screen>
      <View style={{ gap: space.xs, marginTop: space.lg }}>
        <T size="small" tone="t2">Step {at + 1} of {STEPS.length}</T>
        <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {STEPS.map((s, i) => <Bar key={s} on={i <= at} />)}
        </View>
      </View>

      {step === 'where' && (
        <>
          <T size="title" weight="700">Where do you live?</T>
          <T tone="t2">Living costs differ a lot across Australia. We use this to suggest typical costs for your area.</T>
          <Field label="State or territory">
            <Choice wrap label="State or territory" options={STATES.map(s => ({ key: s.key, label: s.label }))} value={state ?? ''}
              onChange={k => { setState(k as StateKey); setRegional(null) }} />
          </Field>
          {state && split && (
            <Field label="City or country?">
              <Choice label="City or country" options={[
                { key: 'metro', label: STATES.find(s => s.key === state)!.capital },
                { key: 'regional', label: 'Regional or rural' },
              ]} value={regional === null ? '' : regional ? 'regional' : 'metro'} onChange={k => setRegional(k === 'regional')} />
            </Field>
          )}
        </>
      )}

      {step === 'you' && <PersonStep title="About you" form={you} set={setYou} />}

      {step === 'partner' && (
        <>
          <T size="title" weight="700">Do you share your finances with a partner?</T>
          <Choice label="Partner" options={YES_NO} value={hasPartner === null ? '' : hasPartner ? 'yes' : 'no'} onChange={k => setHasPartner(k === 'yes')} />
          {hasPartner && <PersonStep form={partner} set={setPartner} partner />}
        </>
      )}

      {step === 'kids' && (
        <>
          <T size="title" weight="700">Any children living with you?</T>
          <Field label="How many?">
            <Choice label="How many children" options={['0', '1', '2', '3', '4', '5'].map(k => ({ key: k, label: k === '0' ? 'None' : k }))} value={String(kids.length)}
              onChange={k => setKids(cur => Array.from({ length: Number(k) }, (_, i) => cur[i] ?? { age: '', care: '0' }))} />
          </Field>
          {kids.map((k, i) => (
            <Card key={i}>
              <T weight="600">Child {i + 1}</T>
              <Field label="Age" hint="In whole years. Use 0 for a baby.">
                <NumberField unit="" label={`Child ${i + 1} age`} value={k.age} onChange={v => setKids(ks => ks.map((x, j) => j === i ? { ...x, age: v } : x))} />
              </Field>
              {validAge(k.age, 0, 4) && (
                <Field label="Days a week in childcare">
                  <Choice label={`Child ${i + 1} childcare days`} options={DAYS} value={k.care} onChange={v => setKids(ks => ks.map((x, j) => j === i ? { ...x, care: v } : x))} />
                </Field>
              )}
            </Card>
          ))}
          {kids.length > 0 && (
            <Field label="What kind of school?" hint="Where they go now, or where you expect them to go.">
              <Choice wrap label="School type" options={[
                { key: 'government', label: 'Government' }, { key: 'catholic', label: 'Catholic' }, { key: 'independent', label: 'Independent' },
              ]} value={schoolType} onChange={k => setSchoolType(k as SchoolType)} />
            </Field>
          )}
          {kids.some(k => validAge(k.age, 0, 4) && Number(k.care) > 0) && state && (
            <T size="small" tone="t2">
              We’ll use about {fmt(typicalChildcareDay(state, split && regional === true))} a day for childcare, before the Child Care Subsidy, which we work out for you.
            </T>
          )}
        </>
      )}

      {step === 'home' && (
        <>
          <T size="title" weight="700">Your home</T>
          <Field label="Where do you live?">
            <Choice wrap label="Home" options={[
              { key: 'mortgage', label: 'Paying a mortgage' }, { key: 'own', label: 'Own it outright' },
              { key: 'rent', label: 'Renting' }, { key: 'other', label: 'Something else' },
            ]} value={home ?? ''} onChange={k => setHome(k as HomeKind)} />
          </Field>
          {home === 'rent' && (
            <Field label="Rent each week">
              <NumberField label="Rent each week" value={rent} onChange={setRent}
                typical={state ? typicalWeeklyRent(state, split && regional === true) : undefined} typicalNote="typical for your area" />
            </Field>
          )}
          {home === 'mortgage' && (
            <>
              <Field label="How much is left on the loan?">
                <NumberField label="Loan balance" value={loan.balance} onChange={v => setLoan(l => ({ ...l, balance: v }))} />
              </Field>
              <Field label="Interest rate">
                <NumberField unit="%" label="Interest rate" value={loan.rate} onChange={v => setLoan(l => ({ ...l, rate: v }))} typical={TYPICAL.mortgageRate} typicalNote="average variable rate" />
              </Field>
              <Field label="Years left to pay">
                <NumberField unit="years" label="Years left" value={loan.years} onChange={v => setLoan(l => ({ ...l, years: v }))} typical={TYPICAL.mortgageYears} />
              </Field>
            </>
          )}
          <Field label="How many cars does the household run?">
            <Choice label="Cars" options={['0', '1', '2', '3'].map(k => ({ key: k, label: k === '0' ? 'None' : k === '3' ? '3+' : k }))} value={cars ?? ''} onChange={setCars} />
          </Field>
        </>
      )}

      {step === 'money' && (
        <>
          <T size="title" weight="700">Savings and investments</T>
          <T tone="t2">Rough figures are fine. You can change these later.</T>
          <Field label="Cash in the bank" hint="Everyday and savings accounts together.">
            <NumberField label="Cash in the bank" value={cash} onChange={setCash} typical={TYPICAL.cash} typicalNote="typical household savings" />
          </Field>
          <Field label="Shares, ETFs and other investments" hint="Leave empty if none.">
            <NumberField label="Investments" value={investments} onChange={setInvestments} />
          </Field>
        </>
      )}

      {step === 'review' && (
        <Review answers={answers()} edits={edits} setEdits={setEdits} removed={removed} setRemoved={setRemoved}
          replacing={household.exists} saving={saving} error={error} onSave={finish} />
      )}

      {step !== 'review' && (
        <View style={{ gap: space.sm }}>
          <Button title="Next" onPress={() => go(1)} disabled={!ready[step]} />
          <Button kind="quiet" title={at === 0 ? 'Cancel' : 'Back'} onPress={() => go(-1)} />
        </View>
      )}
      {step === 'review' && <Button kind="quiet" title="Back" onPress={() => go(-1)} disabled={saving} />}
    </Screen>
  )
}

function Bar({ on }: { on: boolean }) {
  const p = usePalette()
  return <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: on ? p.t1 : p.border }} />
}

function PersonStep({ title, form, set, partner }: { title?: string; form: PersonForm; set: (f: (p: PersonForm) => PersonForm) => void; partner?: boolean }) {
  const patch = (x: Partial<PersonForm>) => set(f => ({ ...f, ...x }))
  const whose = partner ? 'Their' : 'Your'
  const age = parseAmount(form.age)
  return (
    <>
      {title && <T size="title" weight="700">{title}</T>}
      <Field label={partner ? 'Their first name' : 'Your first name'}>
        <TextField label="First name" value={form.name} onChange={v => patch({ name: v })} />
      </Field>
      <Field label={`${whose} age`}>
        <NumberField unit="" label="Age" value={form.age} onChange={v => patch({ age: v })} />
      </Field>
      <Field label="Days a week working">
        <Choice label="Days a week working" options={[{ key: '0', label: 'Not working' }, ...[1, 2, 3, 4, 5].map(d => ({ key: String(d), label: String(d) }))]}
          wrap value={form.days} onChange={v => patch({ days: v })} />
      </Field>
      {form.days !== '0' && (
        <Field label="Full-time salary" hint="Before tax, not counting super. If part-time, the full-time figure: we scale it by the days worked.">
          <NumberField label="Full-time salary" value={form.salary} onChange={v => patch({ salary: v })} typical={TYPICAL.salary} typicalNote="median full-time pay" />
        </Field>
      )}
      <Field label="Super balance" hint="From the super fund’s app or latest statement.">
        <NumberField label="Super balance" value={form.super} onChange={v => patch({ super: v })}
          typical={Number.isFinite(age) && age > 0 ? typicalSuper(age) : undefined} typicalNote="typical at this age" />
      </Field>
      <Field label="HELP or HECS student debt?">
        <Choice label="HELP debt" options={YES_NO} value={form.hasHelp ? 'yes' : 'no'} onChange={k => patch({ hasHelp: k === 'yes' })} />
      </Field>
      {form.hasHelp && (
        <Field label="HELP balance" hint="On myGov, under ATO → Loans.">
          <NumberField label="HELP balance" value={form.help} onChange={v => patch({ help: v })} typical={TYPICAL.helpBalance} typicalNote="typical balance" />
        </Field>
      )}
    </>
  )
}

function Review({ answers, edits, setEdits, removed, setRemoved, replacing, saving, error, onSave }: {
  answers: StarterAnswers
  edits: Record<string, string>; setEdits: (f: (e: Record<string, string>) => Record<string, string>) => void
  removed: Set<string>; setRemoved: (s: Set<string>) => void
  replacing: boolean; saving: boolean; error: string | null
  onSave: (lines: StarterLine[]) => void
}) {
  const p = usePalette()
  const input = useInputStyle()
  const estimated = estimateLivingCosts(answers)
  const lines = estimated
    .filter(l => !removed.has(l.key))
    .map(l => (edits[l.key] !== undefined ? { ...l, amt: Math.max(0, parseAmount(edits[l.key]) || 0) } : l))

  // The month as it will look: same calculation as Home.
  const plan = buildStarterHousehold(answers, lines, new Date())
  const b = computeBudgetSummary({
    expenses: plan.expenses.map((e, i) => ({ ...e, id: i })), annualExpenses: [], income: { ...plan.income, person1MonthlyNet: 0, person2MonthlyNet: 0 },
    childcare: plan.childcare, rentMonthly: plan.rent.enabled ? plan.rent.monthlyRent : null,
    person1Days: answers.you.days, person2Days: answers.partner?.days ?? 0, partnerEnabled: answers.partner !== null,
  })
  const byCat = CATS.map(cat => ({ cat, lines: estimated.filter(l => l.cat === cat) })).filter(g => g.lines.length)

  return (
    <>
      <T size="title" weight="700">Your first budget</T>
      <T tone="t2">These are typical costs for a household like yours. Change anything that’s off, and remove what doesn’t apply. You can change them all later in Spending.</T>

      <Card tone={b.delta >= 0 ? 'good' : 'bad'}>
        <T size="small" tone="t2">Each month</T>
        <T size="hero" weight="700" tone={b.delta >= 0 ? 'green' : 'red'}>{fmt(Math.abs(b.delta))} {b.delta >= 0 ? 'left over' : 'short'}</T>
        <T tone="t2">{fmt(b.monthlyIncome)} comes in after tax, {fmt(b.monthlyExpenses)} goes out{plan.rent.enabled ? ' (including rent)' : ''}{b.childcareNet ? `, including childcare of about ${fmt(b.childcareNet)} after the subsidy` : ''}.</T>
      </Card>

      {byCat.map(g => (
        <View key={g.cat} style={{ gap: space.sm }}>
          <H2>{g.cat}</H2>
          <Card style={{ gap: space.md }}>
            {g.lines.map(l => {
              const off = removed.has(l.key)
              const value = edits[l.key] ?? String(l.amt)
              return (
                <View key={l.key} style={{ gap: space.xs, opacity: off ? 0.5 : 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <T weight="600" style={{ flex: 1 }}>{l.name}</T>
                    <Pressable accessibilityRole="button" accessibilityLabel={off ? `Add ${l.name} back` : `Remove ${l.name}`}
                      onPress={() => { const s = new Set(removed); if (off) s.delete(l.key); else s.add(l.key); setRemoved(s) }}
                      style={{ minHeight: touch, minWidth: touch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md }}>
                      <T tone={off ? 'blue' : 't3'}>{off ? 'Undo' : 'Remove'}</T>
                    </Pressable>
                  </View>
                  {!off && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <T tone="t2">$</T>
                      <TextInput value={value} onChangeText={v => setEdits(e => ({ ...e, [l.key]: v }))} keyboardType="decimal-pad"
                        style={[input, { flex: 1, maxWidth: 160 }]} accessibilityLabel={`${l.name}, dollars ${FREQ_LABEL[l.freq]}`} placeholderTextColor={p.t3} />
                      <T tone="t2">{FREQ_LABEL[l.freq]}</T>
                      {l.freq !== 'monthly' && <T size="small" tone="t3">≈ {fmt(toMonthly(Math.max(0, parseAmount(value) || 0), l.freq))}/mo</T>}
                    </View>
                  )}
                </View>
              )
            })}
          </Card>
        </View>
      ))}

      {answers.children.some(c => isPreschool(c) && c.childcareDays > 0) && (
        <T size="small" tone="t2">Childcare is worked out from the days in care, after the Child Care Subsidy for your income. Adjust the daily fee later in Spending.</T>
      )}
      {replacing && <T size="small" tone="amber">Saving replaces the household that’s on this device now.</T>}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <Button title={saving ? 'Saving…' : 'Save and start'} onPress={() => onSave(lines)} disabled={saving} />
    </>
  )
}
