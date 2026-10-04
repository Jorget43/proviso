import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateRegistrationOptions } from '@simplewebauthn/server'

function getRpId(req: Request): string {
  if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID
  const origin = req.headers.get('origin')
  if (origin) return new URL(origin).hostname
  return new URL(req.url).hostname
}

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const rpID = getRpId(req)

  const existingPasskeys = await prisma.passkey.findMany({
    where: { userId: user.userId },
    select: { credentialId: true, transports: true },
  })

  const options = await generateRegistrationOptions({
    rpName: 'Proviso',
    rpID,
    userName: user.username,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(String(user.userId)),
    attestationType: 'none',
    excludeCredentials: existingPasskeys.map(pk => ({
      id: pk.credentialId,
      transports: pk.transports ? (pk.transports.split(',').filter(Boolean) as any[]) : [],
    })),
  })

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  await prisma.webAuthnChallenge.create({
    data: { challenge: options.challenge, userId: user.userId, expiresAt },
  })

  return Response.json(options)
}
