import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params
  const body = await request.json()
  const state = await prisma.suggestionState.upsert({
    where:  { cat },
    update: { status: body.status },
    create: { cat, status: body.status },
  })
  return Response.json(state)
}
