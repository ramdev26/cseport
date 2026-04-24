import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'

type Stats = {
  users: number
  events: number
  published_events: number
  paid_registrations: number
  gross_revenue_lkr: number
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [fee, setFee] = useState('500')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [dash, settings] = await Promise.all([
          apiFetch<{ ok: boolean; stats: Stats }>('/api/admin/dashboard.php'),
          apiFetch<{ ok: boolean; settings: { platform_fee_bps: number } }>('/api/admin/settings.php'),
        ])
        if (cancelled) return
        setStats(dash.stats)
        setFee(String(settings.settings.platform_fee_bps))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Admin</h1>
        <p className="mt-2 text-zinc-600">Platform snapshot and fee configuration (basis points).</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['Users', stats.users],
              ['Events', stats.events],
              ['Published', stats.published_events],
              ['Paid registrations', stats.paid_registrations],
              ['Gross revenue (LKR)', stats.gross_revenue_lkr],
            ] as const
          ).map(([label, value]) => (
            <Card key={label}>
              <CardHeader>
                <CardTitle className="text-base">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Platform fee</CardTitle>
          <CardDescription>500 bps = 5%. Applied in reporting; payments are gross to merchant in MVP.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              await apiFetch('/api/admin/settings.php', {
                method: 'PUT',
                body: JSON.stringify({ platform_fee_bps: Number(fee) }),
              })
            }}
          >
            <div>
              <Label htmlFor="fee">Basis points</Label>
              <Input id="fee" className="mt-1 w-40" value={fee} onChange={(e) => setFee(e.target.value)} />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
