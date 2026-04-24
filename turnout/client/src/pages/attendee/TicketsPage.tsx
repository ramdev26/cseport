import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'

type Ticket = {
  id: string
  event_title: string
  event_slug: string
  tier_name: string
  qr_payload: string | null
  amount_lkr: number
}

export function TicketsPage() {
  const [rows, setRows] = useState<Ticket[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch<{ ok: boolean; data: Ticket[] }>('/api/tickets/my-tickets.php')
        if (!cancelled) setRows(res.data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Your tickets</h1>
        <p className="mt-2 text-zinc-600">Paid registrations appear here with a scannable QR payload.</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="space-y-4">
        {rows.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No tickets yet</CardTitle>
              <CardDescription>Pick an event from discover and complete checkout.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link className="text-sm font-medium text-primary hover:underline" to="/attendee/discover">
                Browse events
              </Link>
            </CardContent>
          </Card>
        ) : (
          rows.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">{t.event_title}</CardTitle>
                  <CardDescription>
                    {t.tier_name} · Rs. {t.amount_lkr.toLocaleString()}
                  </CardDescription>
                </div>
                {t.qr_payload ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(t.qr_payload)}`}
                    width={120}
                    height={120}
                    alt="Ticket QR"
                    className="rounded-lg border border-zinc-100 bg-white p-2 shadow-sm"
                  />
                ) : null}
              </CardHeader>
              <CardContent>
                <Link className="text-sm font-medium text-primary hover:underline" to={`/e/${encodeURIComponent(t.event_slug)}`}>
                  View event page
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
