// Role-based access control (Phase 4.1). Which role may do what is in
// roles.ts (shared with client screens); this enforces it on the API.
// Reads are not gated here (page-level requireSession covers authentication).

import { getSession, type SessionUser } from './auth'
import { setAuditActor } from './audit'
import { can, type Action } from './roles'

export { can, type Action }

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
  // Name the actor for the audit trail: every write this request makes from
  // here on is recorded against them.
  setAuditActor({ userId: user.userId, username: user.username })
  return { ok: true, user }
}

// Read guard for GET routes that expose household financial/personal data.
// Requires an authenticated session and excludes CHILD (whose only data lives
// under /api/pocket-money + /api/allowance). Mirrors requireAdult() for pages.
// Public endpoints (e.g. /api/version) intentionally skip this.
export async function requireAdultRead(): Promise<AuthResult> {
  const user = await getSession()
  if (!user) return { ok: false, res: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role === 'CHILD') return { ok: false, res: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ok: true, user }
}
