import { NextRequest } from 'next/server'
import { packagedItemSchema } from '@proviso/core/schemas'
import { parseBody, withErrors, ApiError } from '@/lib/apiHandler'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { prisma } from '@/lib/db'

// Salary packaging items (@proviso/core/packaging).

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const items = await prisma.packagedItem.findMany({ orderBy: { id: 'asc' } })
  return Response.json(items)
}

export const POST = withErrors(async (request: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, packagedItemSchema)
  if (!body.person || !body.kind) throw new ApiError(400, 'Choose whose pay it comes from and what kind of packaging it is.')
  const item = await prisma.packagedItem.create({
    data: {
      person: body.person, kind: body.kind, amount: body.amount ?? 0, carPrice: body.carPrice ?? null,
      startYear: body.startYear ?? new Date().getFullYear(), endYear: body.endYear ?? null,
    },
  })
  return Response.json(item, { status: 201 })
})
