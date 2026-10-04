import { prisma } from '@/lib/db'
import { assetSchema } from '@/lib/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { NextRequest } from 'next/server'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const assets = await prisma.asset.findMany({ orderBy: { id: 'asc' } })
  return Response.json(assets)
}

export const POST = withErrors(async (request: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, assetSchema)
  const asset = await prisma.asset.create({
    data: { name: body.name ?? 'New asset', amt: body.amt ?? 0, isOffset: body.isOffset ?? false },
  })
  return Response.json(asset, { status: 201 })
})
