// What each role may change, with no server imports, so client screens can
// ask the same question the API answers (rbac.ts enforces it).
//   - 'actuals:write' → importing/categorising bank actuals
//   - 'budget:write'  → the household's money: budget, debts, super, the plan, settings
//   - 'users:write'   → adding and changing members
//   - 'child:write'   → a child's own pocket money
// Partners change the household's money as fully as the CFO (it's theirs
// too); managing members, the activity log and the data download stay with
// the CFO.

export type Role = 'CFO' | 'PARTNER' | 'CHILD'
export type Action = 'actuals:write' | 'budget:write' | 'users:write' | 'child:write'

const MATRIX: Record<Role, Action[]> = {
  CFO:     ['actuals:write', 'budget:write', 'users:write', 'child:write'],
  PARTNER: ['actuals:write', 'budget:write'],
  CHILD:   ['child:write'],
}

export function can(role: string, action: Action): boolean {
  return MATRIX[role as Role]?.includes(action) ?? false
}
