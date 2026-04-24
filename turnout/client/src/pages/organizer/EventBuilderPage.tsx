import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageBuilder } from '@/components/builder/PageBuilder'
import { apiFetch } from '@/lib/api'
import { useBuilderStore } from '@/stores/builderStore'
import type { PageSchema } from '@/types/blocks'

type EventPayload = {
  id: string
  slug: string
  page_schema: PageSchema
}

export function EventBuilderPage() {
  const { id } = useParams()
  const setEvent = useBuilderStore((s) => s.setEvent)
  const reset = useBuilderStore((s) => s.reset)
  const [slug, setSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch<{ ok: boolean; event: EventPayload }>(`/api/events/get.php?id=${encodeURIComponent(id)}`)
        if (cancelled) return
        setSlug(res.event.slug)
        setEvent(res.event.id, res.event.page_schema)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
      reset()
    }
  }, [id, setEvent, reset])

  if (error) return <p className="px-4 py-12 text-center text-sm text-red-600">{error}</p>
  if (!id || !slug) return <div className="px-4 py-16 text-center text-sm text-zinc-500">Loading builder…</div>

  return <PageBuilder eventId={id} slug={slug} />
}
