import { describe, it, expect, vi } from 'vitest'
import { findHelpDebt, validateMemberNames, renameMembers, helpDebtName } from '@/lib/members'

describe('findHelpDebt', () => {
  const debts = [
    { name: 'Samantha HELP debt', amt: 1 },
    { name: 'Sam HELP debt', amt: 2 },
    { name: 'Car loan', amt: 3 },
  ]

  it('matches the exact "<name> HELP debt" row', () => {
    expect(findHelpDebt(debts, 'Sam')?.amt).toBe(2)
    expect(findHelpDebt(debts, 'Samantha')?.amt).toBe(1)
  })

  it('never matches by substring', () => {
    expect(findHelpDebt([{ name: 'Samantha HELP debt', amt: 1 }], 'Sam')).toBeUndefined()
  })

  it('falls back to a HELP/HECS debt that starts with the name as a whole word', () => {
    expect(findHelpDebt([{ name: 'Alex HECS', amt: 5 }], 'Alex')?.amt).toBe(5)
    expect(findHelpDebt([{ name: 'Alex car loan', amt: 5 }], 'Alex')).toBeUndefined()
  })
})

describe('validateMemberNames', () => {
  it('requires distinct, non-empty names when there is a partner', () => {
    expect(validateMemberNames('Alex', 'alex', true)).toMatch(/different/)
    expect(validateMemberNames('Alex', '  ', true)).toMatch(/Person 2/)
    expect(validateMemberNames('', 'Sam', true)).toMatch(/Person 1/)
    expect(validateMemberNames('Alex', 'Sam', true)).toBeNull()
  })

  it("ignores Person 2's name when there is no partner", () => {
    expect(validateMemberNames('Alex', 'Alex', false)).toBeNull()
  })
})

describe('renameMembers', () => {
  function fakeTx() {
    const calls: { table: string; from: string; to: string }[] = []
    const table = (name: string) => ({
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, string>; data: Record<string, string> }) => {
        calls.push({ table: name, from: where.member ?? where.name, to: data.member ?? data.name })
        return { count: 0 }
      }),
    })
    return {
      calls,
      tx: { superHistory: table('superHistory'), helpDebtDetail: table('helpDebtDetail'), investmentParcel: table('investmentParcel'), debt: table('debt') },
    }
  }

  it('cascades to every name-keyed table, including the HELP debt row', async () => {
    const { tx, calls } = fakeTx()
    await renameMembers(tx, [{ from: 'Alex', to: 'Jamie' }])
    const tables = new Set(calls.map(c => c.table))
    expect(tables).toEqual(new Set(['superHistory', 'helpDebtDetail', 'investmentParcel', 'debt']))
    const finalDebt = calls.filter(c => c.table === 'debt').at(-1)
    expect(finalDebt?.to).toBe(helpDebtName('Jamie'))
  })

  it('routes a swap through temporary names so the two never collide', async () => {
    const { tx, calls } = fakeTx()
    await renameMembers(tx, [{ from: 'Alex', to: 'Sam' }, { from: 'Sam', to: 'Alex' }])
    const sh = calls.filter(c => c.table === 'superHistory')
    // First pass moves both to temps, second pass moves temps to the targets.
    expect(sh[0]).toMatchObject({ from: 'Alex' })
    expect(sh[1]).toMatchObject({ from: 'Sam' })
    expect(sh[0].to).toMatch(/^__renaming_/)
    expect(sh.slice(2).map(c => c.to)).toEqual(['Sam', 'Alex'])
  })

  it('does nothing when names are unchanged or blank', async () => {
    const { tx, calls } = fakeTx()
    await renameMembers(tx, [{ from: 'Alex', to: 'Alex' }, { from: '', to: 'Sam' }])
    expect(calls).toHaveLength(0)
  })
})
