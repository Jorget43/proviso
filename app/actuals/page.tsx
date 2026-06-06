export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import ActualsClient from '@/components/actuals/ActualsClient'

export default async function ActualsPage() {
  const [txns, rules, suggStates, expenses, actualsSettings] = await Promise.all([
    prisma.transaction.findMany({ orderBy: { importedAt: 'asc' } }),
    prisma.categoriationRule.findMany({ orderBy: { id: 'asc' } }),
    prisma.suggestionState.findMany(),
    prisma.expense.findMany({ orderBy: { id: 'asc' } }),
    prisma.actualsSettings.findFirst(),
  ])

  const initialSuggStatus = Object.fromEntries(
    suggStates.map(s => [s.cat, s.status as 'pending' | 'accepted' | 'dismissed'])
  )

  return (
    <ActualsClient
      initialTxns={txns}
      initialRules={rules.map(r => ({ id: r.id, pattern: r.pattern, cat: r.cat, source: r.source as 'user' | 'system', hits: r.hits }))}
      initialSuggStatus={initialSuggStatus}
      initialExpenses={expenses}
      initialUseActuals={actualsSettings?.useActualsProjections ?? false}
    />
  )
}
