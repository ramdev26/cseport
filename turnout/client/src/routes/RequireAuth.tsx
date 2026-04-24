import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export function RequireAuth({ children, redirectTo }: { children: ReactNode; redirectTo: string }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return <div className="px-4 py-24 text-center text-sm text-zinc-500">Loading…</div>
  }
  if (!user) {
    return <Navigate to={redirectTo} replace />
  }
  return children
}
