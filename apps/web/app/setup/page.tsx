export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { hasAnyUser } from '@/lib/auth'
import AuthForm from '@/components/auth/AuthForm'

export default async function SetupPage() {
  // Setup is first-run only.
  if (await hasAnyUser()) redirect('/login')
  return <AuthForm mode="setup" />
}
