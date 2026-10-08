// The projection's assumptions, in plain terms, plus the retirement income
// goal. The NAS shows more dials (near-term inflation, childcare inflation);
// here one inflation figure sets both.

import { possessive } from '@proviso/core/formatting'
import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { retirementIncomeGoal, spendingInRetirement } from '@proviso/core/future'
import { computeBudgetSummary } from '@proviso/core/budgetSummary'
import { workDaysForYear } from '@proviso/core/projections'
import { useHousehold } from '@/data/DataProvider'
import { saveAssumptions } from '@/data/future'
import { Button, Choice, Field, NumberField, Sheet, T, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]

export default function AssumptionsSheet() {
  const { household: h, change } = useHousehold()
  const s = h.projection
  const year = new Date().getFullYear()
  const budget = computeBudgetSummary({
    expenses: h.expenses, annualExpenses: h.annualExpenses, income: h.income, childcare: h.childcare,
    rentMonthly: h.rent.enabled ? h.rent.monthlyRent : null,
    person1Days: workDaysForYear(h.workPhases.filter(w => w.person === 'p1'), year),
    person2Days: workDaysForYear(h.workPhases.filter(w => w.person === 'p2'), year),
    partnerEnabled: h.settings.partnerEnabled,
  })
  const goal = retirementIncomeGoal(h.superSettings.desiredRetirementIncome, spendingInRetirement(budget, h.expenses))

  const [f, setF] = useState({
    p1: String(s.person1Growth), p2: String(s.person2Growth), infl: String(s.expInfl), ret: String(s.investReturn),
    save: String(s.savingsRate), prop: String(s.propGrowth), years: String(s.projYears), monthly: String(Math.round(goal / 12)),
    fees: s.schoolFeesOn,
  })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }))
  const hasKids = h.expenses.some(e => e.cat === 'Children') || s.sfPresetKey !== null

  async function save() {
    const n = (v: string) => parseAmount(v)
    const pct = [n(f.p1), n(f.p2), n(f.infl), n(f.ret), n(f.save), n(f.prop)]
    if (pct.some(x => !Number.isFinite(x) || x < -5 || x > 100)) { setError('Check the percentages.'); return }
    const years = n(f.years)
    if (!Number.isInteger(years) || years < 5 || years > 50) { setError('Years ahead: between 5 and 50.'); return }
    if (!(n(f.monthly) >= 0)) { setError('Check the retirement income.'); return }
    await change(db => saveAssumptions(db, {
      person1Growth: pct[0], person2Growth: pct[1], expInfl: pct[2], investReturn: pct[3], savingsRate: pct[4], propGrowth: pct[5],
      projYears: years, schoolFeesOn: f.fees,
    }, Math.round(n(f.monthly) * 12)))
    router.back()
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: 'Assumptions' }} />
      <Field label={`${possessive(h.settings.person1Name)} pay rises`}>
        <NumberField unit="%" label={`${possessive(h.settings.person1Name)} pay rises, percent a year`} value={f.p1} onChange={set('p1')} />
      </Field>
      {h.settings.partnerEnabled && (
        <Field label={`${possessive(h.settings.person2Name)} pay rises`}>
          <NumberField unit="%" label={`${possessive(h.settings.person2Name)} pay rises, percent a year`} value={f.p2} onChange={set('p2')} />
        </Field>
      )}
      <Field label="Prices rise" hint="Inflation: how fast your costs grow each year.">
        <NumberField unit="%" label="Prices rise, percent a year" value={f.infl} onChange={set('infl')} />
      </Field>
      <Field label="Investments return" hint="After fees, before tax.">
        <NumberField unit="%" label="Investment return, percent a year" value={f.ret} onChange={set('ret')} />
      </Field>
      <Field label="Share of what’s left over that’s invested" hint="The rest stays as cash.">
        <NumberField unit="%" label="Share invested, percent" value={f.save} onChange={set('save')} />
      </Field>
      <Field label="Home values grow">
        <NumberField unit="%" label="Home values grow, percent a year" value={f.prop} onChange={set('prop')} />
      </Field>
      <Field label="Years ahead">
        <NumberField unit="years" label="Years ahead" value={f.years} onChange={set('years')} />
      </Field>
      <Field label="Income you’d like in retirement" hint="A month, in today’s money, for the household. It starts as what you spend now, less the home loan and the children’s costs.">
        <NumberField label="Retirement income a month" value={f.monthly} onChange={set('monthly')} />
      </Field>
      {hasKids && (
        <Field label="Model school fees year by year?" hint="Fees rise each year and stop after Year 12, for the two eldest children. Their school costs in Spending are left out of the projection so they aren’t counted twice.">
          <Choice label="Model school fees" options={YES_NO} value={f.fees ? 'yes' : 'no'} onChange={k => setF(x => ({ ...x, fees: k === 'yes' }))} />
        </Field>
      )}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
      </View>
    </Sheet>
  )
}
