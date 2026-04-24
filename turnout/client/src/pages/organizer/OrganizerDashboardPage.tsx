import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'

type EventRow = {
  id: string
  title: string
  slug: string
  status: string
  starts_at: string | null
  updated_at: string
}

export function OrganizerDashboardPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [revenue, setRevenue] = useState<{ gross: number; sales: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [list, rev] = await Promise.all([
          apiFetch<{ ok: boolean; data: EventRow[] }>('/api/events/list.php?mine=1&per_page=50'),
          apiFetch<{ ok: boolean; summary: { gross: number; sales: number } }>('/api/organizer/revenue.php'),
        ])
        if (!cancelled) {
          setEvents(list.data)
          setRevenue(rev.summary)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Organizer</h1>
          <p className="mt-2 text-zinc-600">Create events, design pages, and track ticket performance.</p>
        </div>
        <Button asChild>
          <Link to="/organizer/events/new">
            <Plus className="h-4 w-4" />
            New event
          </Link>
        </Button>
      </div>

      {revenue ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gross ticket revenue</CardTitle>
              <CardDescription>All paid registrations across your events (LKR).</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-zinc-900">Rs. {revenue.gross.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tickets sold</CardTitle>
              <CardDescription>Paid registrations count.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-zinc-900">{revenue.sales}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Your events</CardTitle>
          <CardDescription>Drafts and published events you control.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">No events yet. Start with a new event.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {events.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium text-zinc-900">{ev.title}</p>
                    <p className="text-xs text-zinc-500">
                      /e/{ev.slug} · {ev.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/organizer/events/${ev.id}/builder`}>Page builder</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/organizer/events/${ev.id}/tiers`}>Tiers</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/e/${encodeURIComponent(ev.slug)}`} target="_blank" rel="noreferrer">
                        View
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
