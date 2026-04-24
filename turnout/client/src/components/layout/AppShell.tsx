import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const link = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm font-medium transition hover:text-zinc-900', isActive ? 'text-zinc-900' : 'text-zinc-500')

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const refresh = useAuthStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-zinc-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              T
            </span>
            TurnOut
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <NavLink to="/attendee/discover" className={link}>
              Discover
            </NavLink>
            {user?.role === 'organizer' || user?.role === 'admin' ? (
              <NavLink to="/organizer" className={link}>
                Organizer
              </NavLink>
            ) : null}
            {user?.role === 'admin' ? (
              <NavLink to="/admin" className={link}>
                Admin
              </NavLink>
            ) : null}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-sm text-zinc-600 sm:inline">{user.full_name}</span>
                <Button variant="secondary" size="sm" onClick={() => void logout()}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/attendee/login">Attendee</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/organizer/login">Organizer</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
