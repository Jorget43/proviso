export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getSession, hasAnyUser } from '@/lib/auth'
import AuthForm from '@/components/auth/AuthForm'

export default async function LoginPage() {
  // No users yet → send to first-run setup.
  if (!(await hasAnyUser())) redirect('/setup')
  // Already signed in → home.
  if (await getSession()) redirect('/')

  return <AuthForm mode="login" />
}
