import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const phases = await prisma.jorgePhase.findMany({ orderBy: { year: 'asc' } })
  return Response.json(phases)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const phase = await prisma.jorgePhase.create({ data: { year: body.year, days: body.days ?? 5 } })
  return Response.json(phase, { status: 201 })
}
