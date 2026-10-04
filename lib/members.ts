// Household member identity helpers.
//
// Several tables store a member's *display name* rather than a stable key:
// SuperHistory.member, HelpDebtDetail.member, InvestmentParcel.member, plus
// the "<name> HELP debt" Debt row that onboarding creates. Renaming a person
// must therefore cascade to all of them, or their history silently detaches
// (it would no longer match either person). All renames go through
// renameMembers() so the cascade can't be forgotten.

export const MAX_NAME_LENGTH = 40

export function helpDebtName(member: string): string {
  return `${member} HELP debt`
}

// A member's HELP debt: the exact "<name> HELP debt" row onboarding creates,
// else a HELP/HECS-named debt whose name starts with the member's name as a
// whole word. Never a plain substring match — that would hand "Samantha HELP
// debt" to "Sam".
export function findHelpDebt<T extends { name: string }>(debts: T[], member: string): T | undefined {
  const exact = helpDebtName(member).toLowerCase()
  const byExact = debts.find(d => d.name.trim().toLowerCase() === exact)
  if (byExact || !member.trim()) return byExact
  const prefix = new RegExp(`^${member.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu')
  return debts.find(d => /help|hecs/i.test(d.name) && prefix.test(d.name.trim()))
}

// Returns an error message, or null when the names are acceptable.
export function validateMemberNames(person1Name: string, person2Name: string, partnerEnabled: boolean): string | null {
  const p1 = person1Name.trim()
  const p2 = person2Name.trim()
  if (!p1) return 'Person 1 needs a name'
  if (partnerEnabled && !p2) return 'Person 2 needs a name'
  if (p1.length > MAX_NAME_LENGTH || p2.length > MAX_NAME_LENGTH) return `Names can be at most ${MAX_NAME_LENGTH} characters`
  // Records are matched by name, so the two people must be distinguishable.
  if (partnerEnabled && p1.toLowerCase() === p2.toLowerCase()) return 'The two people need different names'
  return null
}

// Just the operations the cascade needs — satisfied by both the plain and the
// retry-extended Prisma transaction clients (lib/db.ts).
type RenameArgs = { where: { member?: string; name?: string }; data: { member?: string; name?: string } }
type Tx = Record<'superHistory' | 'helpDebtDetail' | 'investmentParcel' | 'debt', {
  updateMany: (args: RenameArgs) => PromiseLike<unknown>
}>

async function renameOne(tx: Tx, from: string, to: string): Promise<void> {
  await tx.superHistory.updateMany({ where: { member: from }, data: { member: to } })
  await tx.helpDebtDetail.updateMany({ where: { member: from }, data: { member: to } })
  await tx.investmentParcel.updateMany({ where: { member: from }, data: { member: to } })
  await tx.debt.updateMany({ where: { name: helpDebtName(from) }, data: { name: helpDebtName(to) } })
}

// Cascade display-name changes to every name-keyed row. Goes via temporary
// names first, so swapping the two people's names (A→B, B→A) can't collide
// on the (member, financialYearEnding) unique constraints mid-way.
export async function renameMembers(
  tx: Tx,
  renames: { from: string; to: string }[],
): Promise<void> {
  const changes = renames
    .map(r => ({ from: r.from.trim(), to: r.to.trim() }))
    .filter(r => r.from && r.to && r.from !== r.to)
  if (changes.length === 0) return
  const stamp = Date.now()
  const temps = changes.map((r, i) => ({ ...r, temp: `__renaming_${stamp}_${i}__` }))
  for (const r of temps) await renameOne(tx, r.from, r.temp)
  for (const r of temps) await renameOne(tx, r.temp, r.to)
}
