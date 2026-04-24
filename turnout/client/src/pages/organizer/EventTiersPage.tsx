import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

type Tier = {
  id: string
  name: string
  description: string | null
  price_lkr: number
  quantity: number
  sold: number
}

export function EventTiersPage() {
  const { id } = useParams()
  const [tiers, setTiers] = useState<Tier[]>([])
  const [name, setName] = useState('General')
  const [price, setPrice] = useState('1500')
  const [qty, setQty] = useState('100')
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!id) return
    const res = await apiFetch<{ ok: boolean; tiers: Tier[] }>(
      `/api/tickets/list-tiers.php?event_id=${encodeURIComponent(id)}`,
    )
    setTiers(res.tiers)
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [id])

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Ticket tiers</h1>
          <p className="text-sm text-zinc-600">Price is stored as LKR integer (no decimals in DB).</p>
        </div>
        <Button variant="secondary" asChild>
          <Link to={`/organizer/events/${id}/builder`}>Back to builder</Link>
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Add tier</CardTitle>
          <CardDescription>Create purchasable tiers for this event.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!id) return
              setError(null)
              try {
                await apiFetch('/api/tickets/create-tier.php', {
                  method: 'POST',
                  body: JSON.stringify({
                    event_id: id,
                    name,
                    price_lkr: Number(price),
                    quantity: Number(qty),
                  }),
                })
                setName('VIP')
                await load()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed')
              }
            }}
          >
            <div className="sm:col-span-1">
              <Label>Name</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Price (LKR)</Label>
              <Input className="mt-1" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input className="mt-1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} required />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit">Add tier</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing tiers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tiers.map((t) => (
            <div key={t.id} className="flex flex-wrap justify-between gap-3 rounded-lg border border-zinc-100 p-3">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-zinc-600">
                  Rs. {t.price_lkr.toLocaleString()} · sold {t.sold}/{t.quantity || '∞'}
                </p>
              </div>
            </div>
          ))}
          {tiers.length === 0 ? <p className="text-sm text-zinc-500">No tiers yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
