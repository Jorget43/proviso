import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const passkeys = await prisma.passkey.findMany({
    where: { userId: user.userId },
    select: { id: true, name: true, deviceType: true, backedUp: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return Response.json(passkeys)
}
