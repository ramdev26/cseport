const base = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? ''

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error('Invalid JSON from API')
  }
  if (!res.ok) {
    const err = (data as { error?: string })?.error ?? res.statusText
    throw new Error(err)
  }
  return data as T
}
