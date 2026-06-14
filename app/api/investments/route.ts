import { prisma } from '@/lib/db'
import { authorize } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export async function GET() {
  const parcels = await prisma.investmentParcel.findMany({ orderBy: { id: 'asc' } })
  return Response.json(parcels)
}

export async function POST(request: NextRequest) {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await request.json()
  const parcel = await prisma.investmentParcel.create({
    data: {
      member:        body.member        ?? 'Person 1',
      name:          body.name          ?? 'New holding',
      quantity:      body.quantity      ?? 0,
      purchasePrice: body.purchasePrice ?? 0,
      purchaseDate:  body.purchaseDate  ?? new Date().toISOString().slice(0, 10),
      currentPrice:  body.currentPrice  ?? 0,
      sellYear:      body.sellYear      ?? null,
    },
  })
  return Response.json(parcel, { status: 201 })
}
