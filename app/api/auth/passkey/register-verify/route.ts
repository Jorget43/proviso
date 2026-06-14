import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { verifyRegistrationResponse } from '@simplewebauthn/server'

function getRpParams(req: Request) {
  const rpID = process.env.WEBAUTHN_RP_ID
    ?? (req.headers.get('origin') ? new URL(req.headers.get('origin')!).hostname : new URL(req.url).hostname)
  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  return { rpID, origin }
}

export async function POST(req: Request) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { result, name } = await req.json()

  const { rpID, origin } = getRpParams(req)

  // Decode the clientDataJSON to get the challenge
  const clientDataJSON = JSON.parse(
    Buffer.from(result.response.clientDataJSON, 'base64').toString('utf8'),
  )
  const challenge = clientDataJSON.challenge as string

  const stored = await prisma.webAuthnChallenge.findUnique({ where: { challenge } })
  if (!stored || stored.expiresAt < new Date() || stored.userId !== user.userId) {
    return Response.json({ error: 'Challenge invalid or expired' }, { status: 400 })
  }

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: result,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    })
  } catch (err) {
    return Response.json({ error: 'Verification failed' }, { status: 400 })
  }

  // Clean up used + expired challenges
  await prisma.webAuthnChallenge.deleteMany({
    where: { OR: [{ challenge }, { expiresAt: { lt: new Date() } }] },
  })

  if (!verification.verified || !verification.registrationInfo) {
    return Response.json({ error: 'Verification failed' }, { status: 400 })
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

  const passkey = await prisma.passkey.create({
    data: {
      userId:       user.userId,
      credentialId: credential.id,
      publicKey:    Buffer.from(credential.publicKey),
      counter:      credential.counter,
      deviceType:   credentialDeviceType,
      backedUp:     credentialBackedUp,
      transports:   (credential.transports ?? []).join(','),
      name:         (name as string)?.trim() || 'Passkey',
    },
    select: { id: true, name: true, deviceType: true, backedUp: true, createdAt: true },
  })

  return Response.json({ passkey })
}
