import { prisma } from '@/lib/db'
import { generateAuthenticationOptions } from '@simplewebauthn/server'

function getRpId(req: Request): string {
  if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID
  const origin = req.headers.get('origin')
  if (origin) return new URL(origin).hostname
  return new URL(req.url).hostname
}

export async function POST(req: Request) {
  const rpID = getRpId(req)

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    // No allowCredentials → discoverable credential (browser picks from stored passkeys)
  })

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  await prisma.webAuthnChallenge.create({
    data: { challenge: options.challenge, userId: null, expiresAt },
  })

  return Response.json(options)
}
