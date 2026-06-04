import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const oneoffs = await prisma.oneOff.findMany({ orderBy: { year: 'asc' } })
  return Response.json(oneoffs)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const oneoff = await prisma.oneOff.create({
    data: { name: body.name ?? 'New expense', amt: body.amt ?? 0, year: body.year ?? new Date().getFullYear() + 1 },
  })
  return Response.json(oneoff, { status: 201 })
}
