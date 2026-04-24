import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'

type EventRow = {
  id: string
  title: string
  slug: string
  starts_at: string | null
  organizer_name: string
}

export function DiscoverPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch<{ ok: boolean; data: EventRow[] }>('/api/events/list.php?per_page=24')
        if (!cancelled) setEvents(res.data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Discover events</h1>
        <p className="mt-2 text-zinc-600">Minimal pages, maximum clarity — browse published TurnOut events.</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((ev) => (
          <Link key={ev.id} to={`/e/${encodeURIComponent(ev.slug)}`} className="group block transition hover:-translate-y-0.5">
            <Card className="h-full overflow-hidden border-zinc-200/80 shadow-sm transition group-hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">{ev.title}</CardTitle>
                <CardDescription>
                  {ev.starts_at ? new Date(ev.starts_at).toLocaleString() : 'Date TBA'} · {ev.organizer_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-primary">View page →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
