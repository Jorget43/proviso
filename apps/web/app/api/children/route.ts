import { NextRequest } from 'next/server'
import { childSchema } from '@proviso/core/schemas'
import { parseBody, withErrors } from '@/lib/apiHandler'
import { authorize, requireAdultRead } from '@/lib/rbac'
import { prisma } from '@/lib/db'

export async function GET() {
  const gate = await requireAdultRead()
  if (!gate.ok) return gate.res
  const children = await prisma.child.findMany({ orderBy: [{ birthYear: 'asc' }, { id: 'asc' }] })
  return Response.json(children)
}

export const POST = withErrors(async (request: NextRequest) => {
  const gate = await authorize('budget:write')
  if (!gate.ok) return gate.res
  const body = await parseBody(request, childSchema)
  const child = await prisma.child.create({
    data: { name: body.name?.trim() || null, birthYear: body.birthYear ?? new Date().getFullYear(), birthMonth: body.birthMonth ?? null },
  })
  return Response.json(child, { status: 201 })
})
