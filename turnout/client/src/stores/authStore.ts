import { create } from 'zustand'
import { apiFetch } from '@/lib/api'

export type Role = 'attendee' | 'organizer' | 'admin'

export type User = {
  id: string
  email: string
  full_name: string
  role: Role
}

type AuthState = {
  user: User | null
  loading: boolean
  setUser: (u: User | null) => void
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  refresh: async () => {
    set({ loading: true })
    try {
      const res = await apiFetch<{ ok: boolean; user?: User }>('/api/auth/me.php')
      set({ user: res.user ?? null, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },
  logout: async () => {
    await apiFetch('/api/auth/logout.php', { method: 'POST', body: '{}' })
    set({ user: null })
  },
}))
