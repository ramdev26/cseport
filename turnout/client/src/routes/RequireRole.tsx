import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Role } from '@/stores/authStore'
import { useAuthStore } from '@/stores/authStore'

export function RequireRole({
  children,
  roles,
  redirectTo,
}: {
  children: ReactNode
  roles: Role[]
  redirectTo: string
}) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return <div className="px-4 py-24 text-center text-sm text-zinc-500">Loading…</div>
  }
  if (!user) {
    return <Navigate to={redirectTo} replace />
  }
  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return children
}
