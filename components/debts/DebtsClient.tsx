'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { toMonthly } from '@/lib/formatting'
import DebtGrid, { type DebtItem } from './DebtGrid'
import AssetGrid, { type AssetItem } from './AssetGrid'
import NetPosition from './NetPosition'
import MortgageDetail, { type MortgageSettings } from './MortgageDetail'
import EmergencyFund from './EmergencyFund'
import HelpPanel, { type HelpDetail } from './HelpPanel'
import HelpRepaymentTracker, { type HelpPerson } from './HelpRepaymentTracker'
import HelpIndexationAlert from './HelpIndexationAlert'
import ReadOnlyFence from '@/components/ui/ReadOnlyFence'
import { computeHelpAlert, isInAlertWindow, daysUntilIndexation, type HelpAlert } from '@/lib/help'

interface HouseholdSettings {
  person1Name:    string
  person2Name:    string
  partnerEnabled: boolean
}

interface DebtsClientProps {
  canEdit:            boolean
  initialDebts:       DebtItem[]
  initialAssets:      AssetItem[]
  initialMortgage:    MortgageSettings
  initialExpenses:    { amt: number; freq: string }[]
  householdSettings:  HouseholdSettings
  initialHelpDetails: HelpDetail[]
  helpIncome:         Record<string, number>
  fyEnding:           number
  showHelp:           boolean
  helpPersons:        HelpPerson[]
}

export default function DebtsClient({
  canEdit,
  initialDebts,
  initialAssets,
  initialMortgage,
  initialExpenses,
  householdSettings,
  initialHelpDetails,
  helpIncome,
  fyEnding,
  showHelp,
  helpPersons,
}: DebtsClientProps) {
  const [debts,    setDebts]    = useState<DebtItem[]>(initialDebts)
  const [assets,   setAssets]   = useState<AssetItem[]>(initialAssets)
  const [mortgage, setMortgage] = useState<MortgageSettings>(initialMortgage)

  const totalDebts  = useMemo(() => debts.reduce((s, d) => s + d.amt, 0), [debts])
  const totalAssets = useMemo(() => assets.reduce((s, a) => s + a.amt, 0), [assets])

  const cashOnHand = useMemo(
    () => assets.find(a => a.name.toLowerCase().includes('cash'))?.amt ?? 0,
    [assets],
  )

  // Offset is the sum of cash accounts flagged isOffset — a single source of
  // truth shared with the mortgage. When at least one account is flagged, that
  // sum drives mortgage.offsetBal (the manual field becomes a linked display).
  const offsetAssets = useMemo(() => assets.filter(a => a.isOffset), [assets])
  const offsetLinked = offsetAssets.length > 0
  const offsetTotal  = useMemo(() => offsetAssets.reduce((s, a) => s + a.amt, 0), [offsetAssets])

  const monthlyExpenses = useMemo(
    () => initialExpenses.reduce((s, e) => s + toMonthly(e.amt, e.freq), 0),
    [initialExpenses],
  )

  const mortgageDebtAmt = useMemo(
    () => debts.find(d => d.name.toLowerCase().includes('mortgage'))?.amt ?? mortgage.balance,
    [debts, mortgage.balance],
  )

  // ── Debt CRUD ──
  const addDebt = useCallback(async () => {
    const res = await fetch('/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New debt', amt: 0 }),
    })
    const created: DebtItem = await res.json()
    setDebts(prev => [...prev, created])
  }, [])

  const updateDebt = useCallback(async (id: number, field: string, value: string | number) => {
    const parsed = field === 'amt' ? (parseFloat(String(value)) || 0) : value
    setDebts(prev => prev.map(d => d.id === id ? { ...d, [field]: parsed } : d))
    await fetch(`/api/debts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
  }, [])

  const deleteDebt = useCallback(async (id: number) => {
    setDebts(prev => prev.filter(d => d.id !== id))
    await fetch(`/api/debts/${id}`, { method: 'DELETE' })
  }, [])

  // ── Asset CRUD ──
  const addAsset = useCallback(async () => {
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New asset', amt: 0 }),
    })
    const created: AssetItem = await res.json()
    setAssets(prev => [...prev, created])
  }, [])

  const updateAsset = useCallback(async (id: number, field: string, value: string | number | boolean) => {
    const parsed = field === 'amt' ? (parseFloat(String(value)) || 0) : value
    setAssets(prev => prev.map(a => a.id === id ? { ...a, [field]: parsed } : a))
    await fetch(`/api/assets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
  }, [])

  const deleteAsset = useCallback(async (id: number) => {
    setAssets(prev => prev.filter(a => a.id !== id))
    await fetch(`/api/assets/${id}`, { method: 'DELETE' })
  }, [])

  // ── Mortgage settings ──
  const updateMortgage = useCallback(async (patch: Partial<MortgageSettings>) => {
    setMortgage(prev => ({ ...prev, ...patch }))
    await fetch('/api/mortgage-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }, [])

  // Keep the mortgage offset balance in lock-step with the flagged cash accounts.
  useEffect(() => {
    if (offsetLinked && mortgage.offsetBal !== offsetTotal) {
      updateMortgage({ offsetBal: offsetTotal })
    }
  }, [offsetLinked, offsetTotal, mortgage.offsetBal, updateMortgage])

  // ── HELP indexation state (lifted so the seasonal alert stays in sync with edits) ──
  const helpMembers = useMemo(() => [
    { name: householdSettings.person1Name, detail: initialHelpDetails.find(d => d.member === householdSettings.person1Name) ?? null },
    ...(householdSettings.partnerEnabled
      ? [{ name: householdSettings.person2Name, detail: initialHelpDetails.find(d => d.member === householdSettings.person2Name) ?? null }]
      : []),
  ], [householdSettings, initialHelpDetails])

  const [helpDetails, setHelpDetails] = useState<Record<string, HelpDetail | null>>(
    () => Object.fromEntries(helpMembers.map(m => [m.name, m.detail])),
  )
  const [cpiRate, setCpiRate] = useState(initialHelpDetails.find(d => d.cpiRate != null)?.cpiRate ?? 3.5)

  const saveHelp = async (member: string, patch: Partial<HelpDetail>) => {
    const prev = helpDetails[member]
    const body = {
      member,
      financialYearEnding: fyEnding,
      openingFyBalance:    patch.openingFyBalance    ?? prev?.openingFyBalance    ?? 0,
      estimatedWithheld:   patch.estimatedWithheld   ?? prev?.estimatedWithheld   ?? 0,
      voluntaryRepayments: patch.voluntaryRepayments ?? prev?.voluntaryRepayments ?? 0,
      cpiRate:             patch.cpiRate             ?? cpiRate,
    }
    // Optimistic — keeps the alert reactive while the request is in flight.
    setHelpDetails(d => ({ ...d, [member]: { ...(d[member] ?? { id: 0 }), ...body } as HelpDetail }))
    const res = await fetch('/api/help-debt-detail', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const saved: HelpDetail = await res.json()
    setHelpDetails(d => ({ ...d, [member]: saved }))
  }

  const commitCpiRate = (rate: number) => {
    setCpiRate(rate)
    for (const { name } of helpMembers) {
      if (helpDetails[name]) saveHelp(name, { cpiRate: rate })
    }
  }

  const helpAlerts = useMemo<HelpAlert[]>(() => {
    if (!showHelp || !isInAlertWindow(fyEnding)) return []
    return helpMembers
      .map(({ name }) => {
        const d = helpDetails[name]
        if (!d) return null
        return computeHelpAlert({
          member:              name,
          financialYearEnding: fyEnding,
          openingFyBalance:    d.openingFyBalance,
          voluntaryRepayments: d.voluntaryRepayments,
          cpiRate,
          grossIncome:         helpIncome[name] ?? 0,
        })
      })
      .filter((a): a is HelpAlert => a !== null && a.indexableBase > 0)
  }, [showHelp, fyEnding, helpMembers, helpDetails, cpiRate, helpIncome])

  return (
    <div className="page">
      {helpAlerts.length > 0 && (
        <HelpIndexationAlert
          alerts={helpAlerts}
          daysUntil={daysUntilIndexation(fyEnding)}
          fyEnding={fyEnding}
        />
      )}
      <div className="two-col">
        <div>
          <ReadOnlyFence canEdit={canEdit}>
            <DebtGrid
              debts={debts}
              onAdd={addDebt}
              onUpdate={updateDebt}
              onDelete={deleteDebt}
            />
            <AssetGrid
              assets={assets}
              onAdd={addAsset}
              onUpdate={updateAsset}
              onDelete={deleteAsset}
            />
          </ReadOnlyFence>
        </div>
        <div>
          <NetPosition totalDebts={totalDebts} totalAssets={totalAssets} />
          <ReadOnlyFence canEdit={canEdit}>
            <MortgageDetail
              mortgage={mortgage}
              mortgageDebtAmt={mortgageDebtAmt}
              onUpdate={updateMortgage}
              offsetLinked={offsetLinked}
              offsetAccountCount={offsetAssets.length}
            />
          </ReadOnlyFence>
          <EmergencyFund cashOnHand={cashOnHand} monthlyExpenses={monthlyExpenses} />
          {showHelp && (
            <ReadOnlyFence canEdit={canEdit}>
              <HelpPanel
                members={helpMembers}
                details={helpDetails}
                cpiRate={cpiRate}
                fyEnding={fyEnding}
                onSave={saveHelp}
                onCpiRateChange={setCpiRate}
                onCpiRateCommit={commitCpiRate}
              />
            </ReadOnlyFence>
          )}
          {helpPersons.length > 0 && (
            <HelpRepaymentTracker persons={helpPersons} />
          )}
        </div>
      </div>
    </div>
  )
}
