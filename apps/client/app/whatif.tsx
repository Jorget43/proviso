// What if?: try changes to the long-term plan and watch the result above the
// controls change as you go. Nothing is saved until "Keep these changes"; the
// NAS's Projections page has the same controls (its What if? drawer).

import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import { fmt, fmtK, possessive } from '@proviso/core/formatting'
import { useHousehold } from '@/data/DataProvider'
import { futureView } from '@/data/views'
import { addWorkChange, applyWhatIf, hasChanges, keepWhatIf, startWhatIf, type WhatIf } from '@/data/whatif'
import { Button, Card, Choice, Field, H2, NumberField, Sheet, Stepper, T, parseAmount } from '@/ui/kit'
import { NetWorthBars } from '@/ui/NetWorthBars'
import { usePalette, space } from '@/ui/theme'

const YES_NO = [{ key: 'no', label: 'No' }, { key: 'yes', label: 'Yes' }]
const TERMS = [20, 25, 30, 35].map(y => ({ key: String(y), label: `${y} yrs` }))
const pct = (v: number) => `${v}%`
const daysLabel = (d: number) => (d === 0 ? 'Not working' : d === 5 ? 'Full-time' : `${d} days`)

type Group = 'basics' | 'work' | 'home'

export default function WhatIfSheet() {
  const { household: h, change } = useHousehold()
  const p = usePalette()
  const now = useMemo(() => new Date(), [])
  const year = now.getFullYear()
  const [w, setW] = useState<WhatIf>(() => startWhatIf(h))
  const [group, setGroup] = useState<Group>('basics')

  const plan = useMemo(() => futureView(h, now), [h, now])
  const tried = useMemo(() => futureView(applyWhatIf(h, w), now), [h, w, now])
  const dirty = hasChanges(h, w)

  const setProj = (patch: Partial<WhatIf['projection']>) => setW(x => ({ ...x, projection: { ...x.projection, ...patch } }))
  const setRent = (patch: Partial<WhatIf['rent']>) => setW(x => ({ ...x, rent: { ...x.rent, ...patch } }))
  const s = w.projection
  const r = w.rent
  const hasKids = h.expenses.some(e => e.cat === 'Children') || s.sfPresetKey !== null

  const groups = [
    { key: 'basics', label: 'Basics' },
    { key: 'work', label: 'Work' },
    ...(h.rent.enabled ? [{ key: 'home', label: 'Home' }] : []),
  ]

  // The plan's figures are in today's money; comparing like with like needs the same years ahead.
  const diff = tried.endNetWorthReal - plan.endNetWorthReal
  const sameYears = tried.years === plan.years

  async function keep() {
    await change(db => keepWhatIf(db, h, w))
    router.back()
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'What if?' }} />

      {/* The result stays in view while the controls below scroll. */}
      <View style={{ backgroundColor: p.surface, borderBottomWidth: 1, borderBottomColor: p.border }}>
        <View style={{ padding: space.lg, paddingBottom: space.md, gap: space.xs, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <T size="small" tone="t2">Net worth in {tried.years} years, in today’s money</T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.md }}>
            <T size="title" weight="700">{fmtK(tried.endNetWorthReal)}</T>
            {dirty && (
              <T weight="600" tone={!sameYears ? 't2' : diff >= 0 ? 'green' : 'red'}>
                {!sameYears ? `Your plan: ${fmtK(plan.endNetWorthReal)} in ${plan.years} years`
                  : Math.abs(diff) < 500 ? 'Same as your plan'
                  : `${diff > 0 ? '▲' : '▼'} ${fmtK(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than your plan`}
              </T>
            )}
          </View>
          <NetWorthBars labels={tried.labels} values={tried.netWorth} height={48} />
          <T size="small" tone={tried.retirement.runsOutAt === null ? 't2' : 'amber'}>
            {tried.retirement.runsOutAt === null
              ? `Retirement: ${fmt(tried.retirement.goalMonthly)} a month lasts to age ${tried.retirement.lastAge}.`
              : `Retirement: ${fmt(tried.retirement.goalMonthly)} a month runs your money out around age ${tried.retirement.runsOutAt}.`}
            {tried.borrowing ? ` Savings run out in ${tried.borrowing.from}.` : ''}
          </T>
        </View>
      </View>

      <Sheet>
        <T tone="t2">Nothing changes until you keep it.</T>
        <Choice label="Show settings for" options={groups} value={group} onChange={k => setGroup(k as Group)} />

        {group === 'basics' && (
          <Card>
            <Stepper label="Look ahead until age" min={70} max={105} step={1} value={s.horizonAge} onChange={v => setProj({ horizonAge: v })} format={v => String(v)} />
            <Stepper label={`${possessive(h.settings.person1Name)} pay rise each year`} min={0} max={15} step={0.5} value={s.person1Growth} onChange={v => setProj({ person1Growth: v })} format={pct} />
            {h.settings.partnerEnabled && (
              <Stepper label={`${possessive(h.settings.person2Name)} pay rise each year`} min={0} max={15} step={0.5} value={s.person2Growth} onChange={v => setProj({ person2Growth: v })} format={pct} />
            )}
            <Stepper label="Share of what’s left over that’s invested" min={0} max={100} step={5} value={s.savingsRate} onChange={v => setProj({ savingsRate: v })} format={pct} />
            <Stepper label="Investment growth each year" min={0} max={15} step={0.5} value={s.investReturn} onChange={v => setProj({ investReturn: v })} format={pct} />
            {/* One inflation figure in the app, as on the Assumptions sheet. */}
            <Stepper label="Prices rise each year" min={0} max={8} step={0.5} value={s.expInfl} onChange={v => setProj({ expInfl: v, expInflNear: v })} format={pct} />
            <Stepper label="Home values grow each year" min={0} max={12} step={0.5} value={s.propGrowth} onChange={v => setProj({ propGrowth: v })} format={pct} />
            {hasKids && (
              <Field label="Include school fees?">
                <Choice label="Include school fees" options={YES_NO} value={s.schoolFeesOn ? 'yes' : 'no'} onChange={k => setProj({ schoolFeesOn: k === 'yes' })} />
              </Field>
            )}
          </Card>
        )}

        {group === 'work' && (
          <>
            <T size="small" tone="t2">Days a week at work from a given year. Pay follows the days worked.</T>
            {(['p1', ...(h.settings.partnerEnabled ? ['p2'] : [])] as ('p1' | 'p2')[]).map(person => (
              <WorkChanges key={person} person={person} w={w} setW={setW} year={year}
                name={person === 'p1' ? h.settings.person1Name : h.settings.person2Name}
                leave={person === 'p2' && s.parentalLeaveEnabled} />
            ))}
          </>
        )}

        {group === 'home' && h.rent.enabled && <BuyPlan r={r} setRent={setRent} year={year} />}

        <View style={{ gap: space.sm }}>
          <Button title="Keep these changes" disabled={!dirty} onPress={keep} />
          {dirty && <Button kind="quiet" title="Start over" onPress={() => setW(startWhatIf(h))} />}
          <Button kind="quiet" title={dirty ? 'Close without keeping' : 'Close'} onPress={() => router.back()} />
        </View>
      </Sheet>
    </View>
  )
}

function WorkChanges({ person, name, w, setW, year, leave }: {
  person: 'p1' | 'p2'; name: string; w: WhatIf; setW: (f: (x: WhatIf) => WhatIf) => void; year: number; leave: boolean
}) {
  const p = usePalette()
  const mine = w.workPhases.filter(x => x.person === person).sort((a, b) => a.year - b.year)
  const edit = (id: string, patch: { year?: number; days?: number }) =>
    setW(x => ({ ...x, workPhases: x.workPhases.map(ph => (ph.id === id ? { ...ph, ...patch } : ph)) }))
  const remove = (id: string) => setW(x => ({ ...x, workPhases: x.workPhases.filter(ph => ph.id !== id) }))
  const daysFmt = (d: number) => (d === 0 && leave ? 'Parental leave' : daysLabel(d))

  return (
    <View style={{ gap: space.sm }}>
      <H2>{name}</H2>
      <Card style={{ gap: 0, paddingVertical: space.sm }}>
        {mine.length === 0 && <T tone="t2" style={{ paddingVertical: space.sm }}>Full-time throughout.</T>}
        {mine.map((ph, i) => (
          <View key={ph.id} style={{ gap: space.sm, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: p.border }}>
            {i === 0
              ? <T weight="600">{ph.year <= year ? 'Now' : `From ${ph.year}`}</T>
              : <Stepper label="From" min={Math.max(year, mine[i - 1].year + 1)} max={year + 40} step={1} value={ph.year} onChange={v => edit(ph.id, { year: v })} />}
            <Stepper label="Days a week" min={0} max={5} step={1} value={ph.days} onChange={v => edit(ph.id, { days: v })} format={daysFmt} />
            {i > 0 && (
              <View style={{ alignItems: 'flex-start' }}>
                <Button kind="danger" title="Remove" onPress={() => remove(ph.id)} />
              </View>
            )}
          </View>
        ))}
      </Card>
      <View style={{ alignItems: 'flex-start' }}>
        <Button kind="quiet" title="+ Add a change" onPress={() => setW(x => addWorkChange(x, person, year))} />
      </View>
    </View>
  )
}

function BuyPlan({ r, setRent, year }: { r: WhatIf['rent']; setRent: (patch: Partial<WhatIf['rent']>) => void; year: number }) {
  // Amounts are typed, so the fields keep their text; the draft takes each one once it's a number.
  const [price, setPrice] = useState(String(r.targetPropertyValue))
  const [fromCash, setFromCash] = useState(String(r.depositFromCash))
  const [fromInv, setFromInv] = useState(String(r.depositFromInvestments))
  const amount = (set: (v: string) => void, key: 'targetPropertyValue' | 'depositFromCash' | 'depositFromInvestments') => (v: string) => {
    set(v)
    const n = parseAmount(v)
    if (Number.isFinite(n) && n >= 0) setRent({ [key]: n })
  }
  const deposit = r.targetPropertyValue * r.depositPct / 100

  return (
    <Card>
      <Field label="Plan to buy a home?">
        <Choice label="Plan to buy a home" options={YES_NO} value={r.purchasePlanEnabled ? 'yes' : 'no'} onChange={k => setRent({ purchasePlanEnabled: k === 'yes' })} />
      </Field>
      {r.purchasePlanEnabled && (
        <>
          <Stepper label="Buy in" min={year + 1} max={year + 30} step={1} value={Math.max(year + 1, r.targetPurchaseYear)} onChange={v => setRent({ targetPurchaseYear: v })} />
          <Field label="Price">
            <NumberField label="Home price" value={price} onChange={amount(setPrice, 'targetPropertyValue')} />
          </Field>
          <Stepper label="Deposit" min={5} max={40} step={5} value={r.depositPct} onChange={v => setRent({ depositPct: v })} format={pct} />
          <T size="small" tone="t2">A {fmt(deposit)} deposit and a {fmt(r.targetPropertyValue - deposit)} loan.</T>
          {/* The projection only takes the deposit from what's entered above; flag a gap rather than let it look free. */}
          {r.depositFromCash + r.depositFromInvestments < deposit && (
            <T size="small" tone="amber">
              {fmt(deposit - r.depositFromCash - r.depositFromInvestments)} of the deposit isn’t coming from savings or investments yet, so the result looks better than it should.
            </T>
          )}
          <Field label="Deposit from savings">
            <NumberField label="Deposit from savings" value={fromCash} onChange={amount(setFromCash, 'depositFromCash')} />
          </Field>
          <Field label="Deposit from selling investments" hint="About 12% of what’s sold goes in tax on the gains (a rough estimate).">
            <NumberField label="Deposit from selling investments" value={fromInv} onChange={amount(setFromInv, 'depositFromInvestments')} />
          </Field>
          <Stepper label="Loan interest rate" min={3} max={12} step={0.25} value={r.newMortgageRate} onChange={v => setRent({ newMortgageRate: v })} format={pct} />
          <Field label="Loan length">
            <Choice label="Loan length" options={TERMS} value={String(r.newMortgageTermYrs)} onChange={k => setRent({ newMortgageTermYrs: Number(k) })} />
          </Field>
        </>
      )}
    </Card>
  )
}
