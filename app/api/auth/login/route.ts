import { prisma } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(req: Request) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return Response.json({ error: 'Username and password required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { username: String(username).trim() } })
  // Verify even when the user is missing-ish to avoid leaking which usernames exist.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false
  if (!user || !ok) {
    return Response.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  await createSession(user.id)
  return Response.json({ ok: true })
}
