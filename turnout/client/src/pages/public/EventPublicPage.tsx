import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EventRenderer } from '@/components/event/EventRenderer'
import { PayHereForm } from '@/components/payments/PayHereForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { PageSchema } from '@/types/blocks'

type Tier = {
  id: string
  name: string
  description: string | null
  price_lkr: number
  quantity: number
  sold: number
}

type EventResp = {
  id: string
  title: string
  slug: string
  status: string
  starts_at: string | null
  venue: string | null
  page_schema: PageSchema
  ticket_tiers: Tier[]
}

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  author_name: string
}

export function EventPublicPage() {
  const { slug } = useParams()
  const user = useAuthStore((s) => s.user)
  const [event, setEvent] = useState<EventResp | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tierId, setTierId] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<{ action: string; fields: Record<string, string> } | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch<{ ok: boolean; event: EventResp }>(
          `/api/events/get.php?slug=${encodeURIComponent(slug)}`,
        )
        if (cancelled) return
        setEvent(res.event)
        const rev = await apiFetch<{ ok: boolean; reviews: Review[] }>(
          `/api/reviews/list.php?event_id=${encodeURIComponent(res.event.id)}`,
        )
        if (!cancelled) setReviews(rev.reviews)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Not found')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const metaLine = useMemo(() => {
    if (!event) return ''
    const parts = [
      event.starts_at ? new Date(event.starts_at).toLocaleString() : null,
      event.venue,
    ].filter(Boolean)
    return parts.join(' · ')
  }, [event])

  if (error || !slug) {
    return <p className="px-4 py-24 text-center text-sm text-red-600">{error ?? 'Missing slug'}</p>
  }
  if (!event) {
    return <p className="px-4 py-24 text-center text-sm text-zinc-500">Loading…</p>
  }

  return (
    <div>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">TurnOut</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">{event.title}</h1>
          {metaLine ? <p className="text-sm text-zinc-600">{metaLine}</p> : null}
        </div>
      </div>

      <EventRenderer blocks={event.page_schema.blocks} />

      <div className="mx-auto max-w-3xl px-4 pb-16">
        <Card className="border-emerald-100 bg-gradient-to-b from-white to-emerald-50/40">
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
            <CardDescription>Checkout securely via PayHere in LKR.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {event.ticket_tiers.length === 0 ? (
              <p className="text-sm text-zinc-500">No ticket tiers yet.</p>
            ) : (
              <div className="space-y-3">
                {event.ticket_tiers.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/80 p-4"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">{t.name}</p>
                      {t.description ? <p className="text-sm text-zinc-600">{t.description}</p> : null}
                      <p className="mt-1 text-sm text-zinc-500">
                        Rs. {t.price_lkr.toLocaleString()}
                        {t.quantity > 0 ? ` · ${Math.max(0, t.quantity - t.sold)} left` : ' · Open quantity'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      disabled={t.quantity > 0 && t.sold >= t.quantity}
                      onClick={() => setTierId(t.id)}
                    >
                      {tierId === t.id ? 'Selected' : 'Buy'}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {tierId ? (
              <form
                className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const res = await apiFetch<{
                    ok: boolean
                    checkout: { action: string; fields: Record<string, string> }
                  }>('/api/payments/create-order.php', {
                    method: 'POST',
                    body: JSON.stringify({
                      event_id: event.id,
                      ticket_tier_id: tierId,
                      attendee_name: user?.full_name || guestName,
                      attendee_email: user?.email || guestEmail,
                    }),
                  })
                  setCheckout(res.checkout)
                }}
              >
                {!user ? (
                  <>
                    <div>
                      <Label htmlFor="gname">Full name</Label>
                      <Input id="gname" className="mt-1" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="gemail">Email</Label>
                      <Input
                        id="gemail"
                        type="email"
                        className="mt-1"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        required
                      />
                    </div>
                  </>
                ) : null}
                <Button type="submit" className="w-full">
                  Continue to PayHere
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        {reviews.length ? (
          <div className="mt-10 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">Reviews</h2>
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-medium text-zinc-900">
                    {r.author_name} · {r.rating}/5
                  </p>
                  {r.comment ? <p className="mt-2 text-sm text-zinc-600">{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {checkout ? <PayHereForm action={checkout.action} fields={checkout.fields} /> : null}
    </div>
  )
}
