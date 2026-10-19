// Add or change one salary packaging item (?id= to change, ?kind= to add).

import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { fmt, possessive } from '@proviso/core/formatting'
import {
  PACKAGE_LABELS, capFor, evStatus, EV_PRICE_LIMIT, EV_ANNOUNCED_FULL_EXEMPT_PRICE, type PackageKind,
} from '@proviso/core/packaging'
import { useHousehold } from '@/data/DataProvider'
import { savePackaged, removePackaged } from '@/data/packaging'
import { Button, Choice, Field, NumberField, Sheet, T, parseAmount } from '@/ui/kit'
import { confirmAction } from '@/ui/confirm'
import { space } from '@/ui/theme'

export default function Packaged() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>()
  const { household: h, change } = useHousehold()
  const existing = params.id ? h.packagedItems.find(i => i.id === params.id) : undefined
  const kind = (existing?.kind ?? params.kind ?? 'pbi') as PackageKind
  const year = new Date().getFullYear()

  const [person, setPerson] = useState<'p1' | 'p2'>(existing?.person ?? 'p1')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [price, setPrice] = useState(existing?.carPrice ? String(existing.carPrice) : '')
  const [from, setFrom] = useState(String(existing?.startYear ?? year))
  const [until, setUntil] = useState(existing?.endYear ? String(existing.endYear) : '')
  const [error, setError] = useState<string | null>(null)

  const capped = kind === 'pbi' || kind === 'hospital' || kind === 'mealEntertainment'
  const car = kind === 'evLease' && price.trim() !== '' ? evStatus(parseAmount(price), parseAmount(from) || year) : null

  async function save() {
    let problem: string | null = null
    await change(async db => {
      problem = await savePackaged(db, existing?.id ?? null, {
        person, kind, amount: parseAmount(amount), carPrice: kind === 'evLease' ? parseAmount(price) : null,
        startYear: parseAmount(from), endYear: until.trim() === '' ? null : parseAmount(until),
      })
    })
    if (problem) { setError(problem); return }
    router.back()
  }

  function remove() {
    if (!existing) return
    confirmAction('Remove this packaging?', 'Your take-home pay goes back to what it would be without it.', 'Remove', async () => {
      await change(db => removePackaged(db, existing.id))
      router.back()
    })
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: PACKAGE_LABELS[kind] ?? 'Salary packaging' }} />
      {h.settings.partnerEnabled && (
        <Field label="From whose pay">
          <Choice label="From whose pay" value={person} onChange={k => setPerson(k as 'p1' | 'p2')}
            options={[{ key: 'p1', label: possessive(h.settings.person1Name) }, { key: 'p2', label: possessive(h.settings.person2Name) }]} />
        </Field>
      )}
      <Field label={kind === 'evLease' ? 'Lease and running costs a year' : 'Packaged a year'}
        hint={capped ? `Up to ${fmt(capFor(kind))} a year is tax-free.` : 'Lease payments, charging, insurance, servicing and tyres.'}>
        <NumberField label={kind === 'evLease' ? 'Lease and running costs a year' : 'Amount packaged a year'} value={amount} onChange={setAmount} />
      </Field>
      {kind === 'evLease' && (
        <Field label="The car’s price">
          <NumberField label="The car’s price" value={price} onChange={setPrice} />
        </Field>
      )}
      {car === 'overPriceLimit' && <T tone="amber">Cars costing {fmt(EV_PRICE_LIMIT)} or more aren’t exempt, so this won’t be counted.</T>}
      {car === 'announcedChange' && <T tone="amber">Announced, not yet law: leases from April 2027 on cars over {fmt(EV_ANNOUNCED_FULL_EXEMPT_PRICE)} lose most of the exemption, so this won’t be counted.</T>}
      {car === 'exempt' && <T size="small" tone="t2">Exempt from fringe benefits tax. It still counts towards HELP repayments.</T>}
      {capped && <T size="small" tone="t2">Your employer must be eligible. It still counts towards HELP repayments.</T>}
      <Field label="From the year">
        <NumberField unit="" label="From the year" value={from} onChange={setFrom} />
      </Field>
      <Field label="Until the year" hint="Leave blank to keep it until work stops.">
        <NumberField unit="" label="Until the year" value={until} onChange={setUntil} />
      </Field>
      {error && <T tone="red" accessibilityRole="alert">{error}</T>}
      <View style={{ gap: space.sm }}>
        <Button title="Save" onPress={save} />
        <Button kind="quiet" title="Cancel" onPress={() => router.back()} />
        {existing && <Button kind="danger" title="Remove" onPress={remove} />}
      </View>
    </Sheet>
  )
}
