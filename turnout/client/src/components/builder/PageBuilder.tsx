import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Copy,
  Eye,
  GripVertical,
  Monitor,
  Redo2,
  Save,
  Smartphone,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { EventRenderer } from '@/components/event/EventRenderer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useBuilderStore } from '@/stores/builderStore'
import { BLOCK_TYPES, type BuilderBlock } from '@/types/blocks'

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-stretch gap-2 rounded-xl border bg-white p-3 shadow-sm ring-zinc-900/5 transition',
        isDragging ? 'border-primary/40 opacity-90 ring-2 ring-primary/20' : 'border-zinc-200',
      )}
    >
      <button
        type="button"
        className="flex cursor-grab touch-none items-center rounded-md px-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function PageBuilder({ eventId, slug }: { eventId: string; slug: string }) {
  const schema = useBuilderStore((s) => s.schema)
  const selectedId = useBuilderStore((s) => s.selectedId)
  const setBlocks = useBuilderStore((s) => s.setBlocks)
  const select = useBuilderStore((s) => s.select)
  const updateProps = useBuilderStore((s) => s.updateProps)
  const addBlock = useBuilderStore((s) => s.addBlock)
  const duplicateBlock = useBuilderStore((s) => s.duplicateBlock)
  const removeBlock = useBuilderStore((s) => s.removeBlock)
  const undo = useBuilderStore((s) => s.undo)
  const redo = useBuilderStore((s) => s.redo)

  const [preview, setPreview] = useState<'desktop' | 'mobile'>('desktop')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const selected = useMemo(
    () => schema.blocks.find((b) => b.id === selectedId) ?? schema.blocks[0] ?? null,
    [schema.blocks, selectedId],
  )

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await apiFetch('/api/events/update.php', {
        method: 'PUT',
        body: JSON.stringify({ id: eventId, page_schema: schema }),
      })
      setLastSaved(new Date())
    } finally {
      setSaving(false)
    }
  }, [eventId, schema])

  useEffect(() => {
    const t = window.setInterval(() => {
      void save()
    }, 30000)
    return () => window.clearInterval(t)
  }, [save])

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = schema.blocks.findIndex((b) => b.id === active.id)
    const newIndex = schema.blocks.findIndex((b) => b.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setBlocks(arrayMove(schema.blocks, oldIndex, newIndex))
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void save()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={undo}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={redo}>
              <Redo2 className="h-4 w-4" />
            </Button>
            <span className="text-xs text-zinc-500">
              {lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Auto-save every 30s'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={preview === 'desktop' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setPreview('desktop')}
              aria-label="Desktop preview"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={preview === 'mobile' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setPreview('mobile')}
              aria-label="Mobile preview"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={`/e/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer">
                <Eye className="h-4 w-4" />
                Preview
              </a>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                await apiFetch('/api/events/update.php', {
                  method: 'PUT',
                  body: JSON.stringify({ id: eventId, status: 'published' }),
                })
                await save()
              }}
            >
              Publish
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[220px_1fr_280px]">
        <Card className="h-fit p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Blocks</p>
          <div className="mt-3 flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
            {BLOCK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addBlock(t)}
                className="rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </Card>

        <div className="min-w-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={schema.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div
                className={cn(
                  'mx-auto rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 shadow-inner transition-[max-width]',
                  preview === 'mobile' ? 'max-w-md' : 'max-w-3xl',
                )}
              >
                <div className="space-y-3">
                  {schema.blocks.map((b) => (
                    <SortableRow key={b.id} id={b.id}>
                      <button
                        type="button"
                        onClick={() => select(b.id)}
                        className={cn(
                          'w-full rounded-lg px-2 py-1 text-left transition',
                          selectedId === b.id ? 'bg-emerald-50' : 'hover:bg-zinc-50',
                        )}
                      >
                        <p className="text-xs font-medium uppercase text-zinc-400">{b.type}</p>
                        <p className="truncate text-sm font-medium text-zinc-900">{labelFor(b)}</p>
                      </button>
                    </SortableRow>
                  ))}
                </div>
              </div>
            </SortableContext>
          </DndContext>
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Live canvas</p>
            <div className={cn('mx-auto mt-3', preview === 'mobile' ? 'max-w-sm' : 'max-w-2xl')}>
              <EventRenderer blocks={schema.blocks} />
            </div>
          </div>
        </div>

        <Card className="h-fit p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Settings</p>
            {selected ? (
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => duplicateBlock(selected.id)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(selected.id)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : null}
          </div>
          {selected ? <BlockSettings block={selected} onChange={(props) => updateProps(selected.id, props)} /> : null}
        </Card>
      </div>
    </div>
  )
}

function labelFor(b: BuilderBlock): string {
  if (b.type === 'hero') return String(b.props.title ?? 'Hero')
  if (b.type === 'text') return String(b.props.body ?? 'Text').slice(0, 80)
  return b.type
}

function BlockSettings({
  block,
  onChange,
}: {
  block: BuilderBlock
  onChange: (p: Record<string, unknown>) => void
}) {
  const p = block.props
  if (block.type === 'hero') {
    return (
      <div className="mt-4 space-y-3">
        <div>
          <Label>Title</Label>
          <Input className="mt-1" value={String(p.title ?? '')} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
        <div>
          <Label>Subtitle</Label>
          <Input
            className="mt-1"
            value={String(p.subtitle ?? '')}
            onChange={(e) => onChange({ subtitle: e.target.value })}
          />
        </div>
        <div>
          <Label>Align</Label>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={String(p.align ?? 'left')}
            onChange={(e) => onChange({ align: e.target.value })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>
    )
  }
  if (block.type === 'text') {
    return (
      <div className="mt-4 space-y-3">
        <div>
          <Label>Body</Label>
          <textarea
            className="mt-1 min-h-[120px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={String(p.body ?? '')}
            onChange={(e) => onChange({ body: e.target.value })}
          />
        </div>
        <div>
          <Label>Align</Label>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={String(p.align ?? 'left')}
            onChange={(e) => onChange({ align: e.target.value })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>
    )
  }
  if (block.type === 'image') {
    return (
      <div className="mt-4 space-y-3">
        <div>
          <Label>Image URL</Label>
          <Input className="mt-1" value={String(p.src ?? '')} onChange={(e) => onChange({ src: e.target.value })} />
        </div>
        <div>
          <Label>Alt</Label>
          <Input className="mt-1" value={String(p.alt ?? '')} onChange={(e) => onChange({ alt: e.target.value })} />
        </div>
        <div>
          <Label>Caption</Label>
          <Input
            className="mt-1"
            value={String(p.caption ?? '')}
            onChange={(e) => onChange({ caption: e.target.value })}
          />
        </div>
      </div>
    )
  }
  if (block.type === 'ticket') {
    return (
      <div className="mt-4 space-y-3">
        <div>
          <Label>Headline</Label>
          <Input
            className="mt-1"
            value={String(p.headline ?? '')}
            onChange={(e) => onChange({ headline: e.target.value })}
          />
        </div>
        <div>
          <Label>Sub copy</Label>
          <Input className="mt-1" value={String(p.sub ?? '')} onChange={(e) => onChange({ sub: e.target.value })} />
        </div>
      </div>
    )
  }
  if (block.type === 'video' || block.type === 'map') {
    return (
      <div className="mt-4 space-y-3">
        <div>
          <Label>{block.type === 'map' ? 'Embed URL' : 'Video URL'}</Label>
          <Input
            className="mt-1"
            value={String((block.type === 'map' ? p.embedUrl : p.url) ?? '')}
            onChange={(e) => onChange(block.type === 'map' ? { embedUrl: e.target.value } : { url: e.target.value })}
          />
        </div>
      </div>
    )
  }
  if (block.type === 'countdown') {
    return (
      <div className="mt-4 space-y-3">
        <div>
          <Label>Target (ISO)</Label>
          <Input
            className="mt-1"
            value={String(p.target ?? '')}
            onChange={(e) => onChange({ target: e.target.value })}
          />
        </div>
      </div>
    )
  }
  if (block.type === 'custom_html') {
    return (
      <div className="mt-4 space-y-3">
        <div>
          <Label>HTML</Label>
          <textarea
            className="mt-1 min-h-[160px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs"
            value={String(p.html ?? '')}
            onChange={(e) => onChange({ html: e.target.value })}
          />
        </div>
      </div>
    )
  }
  return <p className="mt-4 text-sm text-zinc-500">This block uses structured content. Edit JSON in a future release.</p>
}
