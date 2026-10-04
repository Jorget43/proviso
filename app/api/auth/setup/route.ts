import { prisma } from '@/lib/db'
import { hashPassword, createSession, hasAnyUser } from '@/lib/auth'

// First-run only: creates the initial CFO. Refuses once any user exists.
export async function POST(req: Request) {
  if (await hasAnyUser()) {
    return Response.json({ error: 'Setup already complete' }, { status: 403 })
  }

  const { name, username, password } = await req.json()
  if (!name || !username || !password) {
    return Response.json({ error: 'Name, username and password required' }, { status: 400 })
  }
  if (String(password).length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const user = await prisma.user.create({
    data: {
      name:         String(name).trim(),
      username:     String(username).trim(),
      passwordHash: await hashPassword(password),
      role:         'CFO',
    },
  })

  await createSession(user.id)
  return Response.json({ ok: true })
}
