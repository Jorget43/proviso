'use client'
import { useState, useMemo, useCallback } from 'react'
import { toMonthly } from '@/lib/formatting'
import DebtGrid, { type DebtItem } from './DebtGrid'
import AssetGrid, { type AssetItem } from './AssetGrid'
import NetPosition from './NetPosition'
import MortgageDetail, { type MortgageSettings } from './MortgageDetail'
import EmergencyFund from './EmergencyFund'
import HelpPanel, { type HelpDetail } from './HelpPanel'
import HelpRepaymentTracker, { type HelpPerson } from './HelpRepaymentTracker'

interface HouseholdSettings {
  person1Name:    string
  person2Name:    string
  partnerEnabled: boolean
}

interface DebtsClientProps {
  initialDebts:       DebtItem[]
  initialAssets:      AssetItem[]
  initialMortgage:    MortgageSettings
  initialExpenses:    { amt: number; freq: string }[]
  householdSettings:  HouseholdSettings
  initialHelpDetails: HelpDetail[]
  fyEnding:           number
  showHelp:           boolean
  helpPersons:        HelpPerson[]
}

export default function DebtsClient({
  initialDebts,
  initialAssets,
  initialMortgage,
  initialExpenses,
  householdSettings,
  initialHelpDetails,
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

  const updateAsset = useCallback(async (id: number, field: string, value: string | number) => {
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

  const helpMembers = [
    { name: householdSettings.person1Name, detail: initialHelpDetails.find(d => d.member === householdSettings.person1Name) ?? null },
    ...(householdSettings.partnerEnabled
      ? [{ name: householdSettings.person2Name, detail: initialHelpDetails.find(d => d.member === householdSettings.person2Name) ?? null }]
      : []),
  ]

  return (
    <div className="page">
      <div className="two-col">
        <div>
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
        </div>
        <div>
          <NetPosition totalDebts={totalDebts} totalAssets={totalAssets} />
          <MortgageDetail
            mortgage={mortgage}
            mortgageDebtAmt={mortgageDebtAmt}
            onUpdate={updateMortgage}
          />
          <EmergencyFund cashOnHand={cashOnHand} monthlyExpenses={monthlyExpenses} />
          {showHelp && (
            <HelpPanel
              members={helpMembers}
              fyEnding={fyEnding}
            />
          )}
          {helpPersons.length > 0 && (
            <HelpRepaymentTracker persons={helpPersons} />
          )}
        </div>
      </div>
    </div>
  )
}
