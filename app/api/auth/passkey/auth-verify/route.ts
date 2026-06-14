import { prisma } from '@/lib/db'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { createSession } from '@/lib/auth'

function getRpParams(req: Request) {
  const rpID = process.env.WEBAUTHN_RP_ID
    ?? (req.headers.get('origin') ? new URL(req.headers.get('origin')!).hostname : new URL(req.url).hostname)
  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  return { rpID, origin }
}

export async function POST(req: Request) {
  const body = await req.json()
  const { rpID, origin } = getRpParams(req)

  // Decode challenge from clientDataJSON
  const clientDataJSON = JSON.parse(
    Buffer.from(body.response.clientDataJSON, 'base64').toString('utf8'),
  )
  const challenge = clientDataJSON.challenge as string

  const stored = await prisma.webAuthnChallenge.findUnique({ where: { challenge } })
  if (!stored || stored.expiresAt < new Date()) {
    return Response.json({ error: 'Challenge invalid or expired' }, { status: 400 })
  }

  // credentialId from the browser response
  const credentialId = body.id as string
  const passkey = await prisma.passkey.findUnique({
    where: { credentialId },
    include: { user: true },
  })
  if (!passkey) return Response.json({ error: 'Unknown credential' }, { status: 400 })

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id:         passkey.credentialId,
        publicKey:  new Uint8Array(passkey.publicKey as Buffer),
        counter:    Number(passkey.counter),
        transports: passkey.transports
          ? (passkey.transports.split(',').filter(Boolean) as any[])
          : undefined,
      },
    })
  } catch {
    return Response.json({ error: 'Verification failed' }, { status: 400 })
  }

  // Clean up challenge
  await prisma.webAuthnChallenge.deleteMany({
    where: { OR: [{ challenge }, { expiresAt: { lt: new Date() } }] },
  })

  if (!verification.verified) {
    return Response.json({ error: 'Verification failed' }, { status: 400 })
  }

  // Update counter to prevent replay attacks
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { counter: verification.authenticationInfo.newCounter },
  })

  await createSession(passkey.userId)
  return Response.json({ ok: true })
}
