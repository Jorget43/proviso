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
import { saveAssumptions, saveRegional } from '@/data/future'
import { DEFAULT_LEAVE_HOME_AGE, MAX_LEAVE_HOME_AGE } from '@proviso/core/lifeStages'
import { Button, Choice, Field, NumberField, Sheet, T, parseAmount } from '@/ui/kit'
import { space } from '@/ui/theme'

const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]
const WHERE = [{ key: 'metro', label: 'Capital city' }, { key: 'regional', label: 'Regional or rural' }]

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
    save: String(s.savingsRate), buffer: String(s.cashBufferMonths), fun: String(s.funPct), prop: String(s.propGrowth), age: String(s.horizonAge), monthly: String(Math.round(goal / 12)),
    fees: s.schoolFeesOn,
    stages: s.lifeStagesOn, leave: String(s.childLeavesHomeAge), regional: h.settings.regional,
    spread: String(s.returnSpread),
    sib2: String(s.sfSib2Pct), sib3: String(s.sfSib3Pct), sib4: String(s.sfSib4Pct), family: String(s.sfFamilyFee), entry: String(s.sfEntryFee),
  })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }))
  const hasKids = h.expenses.some(e => e.cat === 'Children') || s.sfPresetKey !== null
  const n0 = (v: string) => parseAmount(v) || 0

  async function save() {
    const n = (v: string) => parseAmount(v)
    const pct = [n(f.p1), n(f.p2), n(f.infl), n(f.ret), n(f.save), n(f.prop)]
    if (pct.some(x => !Number.isFinite(x) || x < -5 || x > 100)) { setError('Check the percentages.'); return }
    const age = n(f.age)
    if (!Number.isInteger(age) || age < 70 || age > 105) { setError('Look ahead to an age between 70 and 105.'); return }
    if (!(n(f.monthly) >= 0)) { setError('Check the retirement income.'); return }
    const buffer = n(f.buffer), fun = n(f.fun)
    if (!(buffer >= 0 && buffer <= 60)) { setError('Keep a safety net of 0 to 60 months.'); return }
    if (!(fun >= 0 && fun + pct[4] <= 100)) { setError('Investing and fun together can’t be more than 100%.'); return }
    const leave = n(f.leave)
    if (!Number.isInteger(leave) || leave < DEFAULT_LEAVE_HOME_AGE || leave > MAX_LEAVE_HOME_AGE) { setError(`Children leave home between ${DEFAULT_LEAVE_HOME_AGE} and ${MAX_LEAVE_HOME_AGE}.`); return }
    const spread = n(f.spread)
    if (!(spread >= 0 && spread <= 5)) { setError('Show a range of 0 to 5 points.'); return }
    const rules = [n(f.sib2), n(f.sib3), n(f.sib4)]
    if (rules.some(x => !(x >= 0 && x <= 100))) { setError('Sibling discounts are 0 to 100%.'); return }
    if (!(n(f.family) >= 0 && n(f.entry) >= 0)) { setError('Check the school fees.'); return }
    if (f.regional !== h.settings.regional) await change(db => saveRegional(db, f.regional))
    await change(db => saveAssumptions(db, {
      person1Growth: pct[0], person2Growth: pct[1], expInfl: pct[2], investReturn: pct[3], savingsRate: pct[4], propGrowth: pct[5],
      cashBufferMonths: buffer, funPct: fun, lifeStagesOn: f.stages, childLeavesHomeAge: leave, horizonAge: age, schoolFeesOn: f.fees,
      returnSpread: spread,
      sfSib2Pct: rules[0], sfSib3Pct: rules[1], sfSib4Pct: rules[2], sfFamilyFee: n(f.family), sfEntryFee: n(f.entry),
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
      <Field label="Range shown either side" hint="Percentage points. Future shades a band: every year’s investment and super returns this much lower, and higher. 0 turns it off.">
        <NumberField unit="" label="Range of returns shown, percentage points either side" value={f.spread} onChange={set('spread')} />
      </Field>
      <Field label="Safety net kept as cash" hint="Months of spending. What’s left over each year tops it up first; 0 for none.">
        <NumberField unit="" label="Safety net, months of spending" value={f.buffer} onChange={set('buffer')} />
      </Field>
      <Field label="Share of what’s left over that’s invested" hint="Of what’s above the safety net. The rest stays as cash.">
        <NumberField unit="%" label="Share invested, percent" value={f.save} onChange={set('save')} />
      </Field>
      <Field label="Share spent on fun" hint="Holidays, treats, upgrades. It’s spent, so it doesn’t add to what you own.">
        <NumberField unit="%" label="Share spent on fun, percent" value={f.fun} onChange={set('fun')} />
      </Field>
      <Field label="Home values grow">
        <NumberField unit="%" label="Home values grow, percent a year" value={f.prop} onChange={set('prop')} />
      </Field>
      <Field label="Look ahead until age" hint={h.settings.partnerEnabled ? 'The age the younger of you reaches by the last year shown.' : 'Your age in the last year shown.'}>
        <NumberField unit="" label="Look ahead until age" value={f.age} onChange={set('age')} />
      </Field>
      <Field label="Income you’d like in retirement" hint="A month, in today’s money, for the household. It starts as what you spend now, less the home loan and the children’s costs.">
        <NumberField label="Retirement income a month" value={f.monthly} onChange={set('monthly')} />
      </Field>
      <Field label="Where you live" hint="Typical costs are lower outside the capital cities.">
        <Choice label="Where you live" options={WHERE} value={f.regional ? 'regional' : 'metro'} onChange={k => setF(x => ({ ...x, regional: k === 'regional' }))} />
      </Field>
      <Field label="Costs change as everyone gets older?" hint="Children cost more as they grow and less once they leave home, childcare stops at school, work costs stop at retirement, and spending eases from 85.">
        <Choice label="Costs change with age" options={YES_NO} value={f.stages ? 'yes' : 'no'} onChange={k => setF(x => ({ ...x, stages: k === 'yes' }))} />
      </Field>
      {f.stages && h.children.length > 0 && (
        <>
          <Field label="Children stay at home past 18?" hint="Many young adults live at home while they study or start work.">
            <Choice label="Children stay at home past 18" options={YES_NO} value={n0(f.leave) > DEFAULT_LEAVE_HOME_AGE ? 'yes' : 'no'}
              onChange={k => setF(x => ({ ...x, leave: String(k === 'yes' ? 21 : DEFAULT_LEAVE_HOME_AGE) }))} />
          </Field>
          {n0(f.leave) > DEFAULT_LEAVE_HOME_AGE && (
            <Field label="They leave home at" hint={`Between ${DEFAULT_LEAVE_HOME_AGE + 1} and ${MAX_LEAVE_HOME_AGE}.`}>
              <NumberField unit="" label="Age children leave home" value={f.leave} onChange={set('leave')} />
            </Field>
          )}
        </>
      )}
      {hasKids && (
        <Field label="Model school fees year by year?" hint="Fees rise each year and stop after Year 12, for every child, at the schools chosen for each (Settings → People). Their school costs in Spending are left out of the projection so they aren’t counted twice.">
          <Choice label="Model school fees" options={YES_NO} value={f.fees ? 'yes' : 'no'} onChange={k => setF(x => ({ ...x, fees: k === 'yes' }))} />
        </Field>
      )}
      {hasKids && f.fees && (
        <>
          <T weight="600">Your school’s fee rules</T>
          <T size="small" tone="t2">Discounts count the children at school in the same year, eldest first. In today’s dollars.</T>
          <Field label="Off tuition for a 2nd child"><NumberField unit="%" label="Discount for a 2nd child, percent" value={f.sib2} onChange={set('sib2')} /></Field>
          <Field label="Off tuition for a 3rd child"><NumberField unit="%" label="Discount for a 3rd child, percent" value={f.sib3} onChange={set('sib3')} /></Field>
          <Field label="Off tuition for a 4th child or later"><NumberField unit="%" label="Discount for a 4th child or later, percent" value={f.sib4} onChange={set('sib4')} /></Field>
          <Field label="Family fee each year" hint="A building fund or levy, once per family."><NumberField label="Family fee each year" value={f.family} onChange={set('family')} /></Field>
          <Field label="Entry fee per child at each new school" hint="Enrolment, uniform."><NumberField label="Entry fee per child" value={f.entry} onChange={set('entry')} /></Field>
        </>
      )}
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
      </View>
    </Sheet>
  )
}
