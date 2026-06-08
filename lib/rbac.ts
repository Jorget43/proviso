// Role-based access control (Phase 4.1).
//
// Two write scopes cover every mutating route:
//   - 'actuals:write'  → importing/categorising bank actuals
//   - 'budget:write'   → everything else (budget, debts, super, settings, …)
// CFO can do both; PARTNER can only touch Actuals; CHILD has no write access.
// Reads are not gated here (page-level requireSession covers authentication).

import { getSession, type Role, type SessionUser } from './auth'

export type Action = 'actuals:write' | 'budget:write' | 'users:write'

const MATRIX: Record<Role, Action[]> = {
  CFO:     ['actuals:write', 'budget:write', 'users:write'],
  PARTNER: ['actuals:write'],
  CHILD:   [],
}

export function can(role: Role, action: Action): boolean {
  return MATRIX[role]?.includes(action) ?? false
}

type AuthResult =
  | { ok: true;  user: SessionUser }
  | { ok: false; res: Response }

// Guard for route handlers. Call at the top of every mutating handler:
//   const gate = await authorize('budget:write')
//   if (!gate.ok) return gate.res
export async function authorize(action: Action): Promise<AuthResult> {
  const user = await getSession()
  if (!user) return { ok: false, res: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!can(user.role, action)) return { ok: false, res: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ok: true, user }
}
