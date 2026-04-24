import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

export function EventNewPage() {
  const nav = useNavigate()
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>New event</CardTitle>
          <CardDescription>Basics first. You can refine the landing page next.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              try {
                const res = await apiFetch<{ ok: boolean; event?: { id: string } }>('/api/events/create.php', {
                  method: 'POST',
                  body: JSON.stringify({
                    title,
                    slug: slug || undefined,
                    status: 'draft',
                  }),
                })
                if (res.event?.id) nav(`/organizer/events/${res.event.id}/builder`)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not create')
              }
            }}
          >
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input
                id="slug"
                className="mt-1"
                placeholder="auto-generated from title"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full">
              Continue to builder
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
