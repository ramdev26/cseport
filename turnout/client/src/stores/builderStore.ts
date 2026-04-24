import { create } from 'zustand'
import type { BuilderBlock, PageSchema } from '@/types/blocks'
import { BLOCK_TYPES, defaultSchema } from '@/types/blocks'

type BuilderState = {
  eventId: string | null
  schema: PageSchema
  selectedId: string | null
  past: PageSchema[]
  future: PageSchema[]
  setEvent: (eventId: string, schema: PageSchema) => void
  reset: () => void
  select: (id: string | null) => void
  setBlocks: (blocks: BuilderBlock[], recordHistory?: boolean) => void
  updateProps: (id: string, props: Record<string, unknown>) => void
  addBlock: (type: BuilderBlock['type']) => void
  duplicateBlock: (id: string) => void
  removeBlock: (id: string) => void
  undo: () => void
  redo: () => void
}

const clone = (s: PageSchema): PageSchema => JSON.parse(JSON.stringify(s)) as PageSchema

export const useBuilderStore = create<BuilderState>((set, get) => ({
  eventId: null,
  schema: defaultSchema(),
  selectedId: null,
  past: [],
  future: [],

  setEvent: (eventId, schema) =>
    set({
      eventId,
      schema: clone(schema),
      selectedId: schema.blocks[0]?.id ?? null,
      past: [],
      future: [],
    }),

  reset: () =>
    set({
      eventId: null,
      schema: defaultSchema(),
      selectedId: null,
      past: [],
      future: [],
    }),

  select: (id) => set({ selectedId: id }),

  setBlocks: (blocks, recordHistory = true) => {
    const { schema, past } = get()
    const next: PageSchema = { ...schema, blocks: blocks }
    if (recordHistory) {
      set({ past: [...past, clone(schema)], future: [], schema: next })
    } else {
      set({ schema: next })
    }
  },

  updateProps: (id, props) => {
    const { schema, past } = get()
    const nextBlocks = schema.blocks.map((b) =>
      b.id === id ? { ...b, props: { ...b.props, ...props } } : b,
    )
    const next: PageSchema = { ...schema, blocks: nextBlocks }
    set({ past: [...past, clone(schema)], future: [], schema: next })
  },

  addBlock: (type) => {
    if (!BLOCK_TYPES.includes(type)) return
    const id = crypto.randomUUID()
    const block: BuilderBlock = { id, type, props: defaultProps(type) }
    const { schema, past } = get()
    const next: PageSchema = { ...schema, blocks: [...schema.blocks, block] }
    set({ past: [...past, clone(schema)], future: [], schema: next, selectedId: id })
  },

  duplicateBlock: (id) => {
    const { schema, past } = get()
    const src = schema.blocks.find((b) => b.id === id)
    if (!src) return
    const copy: BuilderBlock = {
      ...src,
      id: crypto.randomUUID(),
      props: { ...src.props },
    }
    const idx = schema.blocks.findIndex((b) => b.id === id)
    const blocks = [...schema.blocks.slice(0, idx + 1), copy, ...schema.blocks.slice(idx + 1)]
    const next: PageSchema = { ...schema, blocks }
    set({ past: [...past, clone(schema)], future: [], schema: next, selectedId: copy.id })
  },

  removeBlock: (id) => {
    const { schema, past } = get()
    if (schema.blocks.length <= 1) return
    const blocks = schema.blocks.filter((b) => b.id !== id)
    const next: PageSchema = { ...schema, blocks }
    set({
      past: [...past, clone(schema)],
      future: [],
      schema: next,
      selectedId: blocks[0]?.id ?? null,
    })
  },

  undo: () => {
    const { past, schema, future } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({
      past: past.slice(0, -1),
      schema: clone(prev),
      future: [clone(schema), ...future],
    })
  },

  redo: () => {
    const { future, schema, past } = get()
    if (!future.length) return
    const nxt = future[0]
    set({
      future: future.slice(1),
      schema: clone(nxt),
      past: [...past, clone(schema)],
    })
  },
}))

function defaultProps(type: BuilderBlock['type']): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return { title: 'Hero title', subtitle: 'Supporting line', align: 'center' }
    case 'text':
      return { body: 'Write something memorable for your guests.', align: 'left' }
    case 'image':
      return { src: '', alt: 'Image', caption: '' }
    case 'gallery':
      return { images: [] as string[] }
    case 'video':
      return { url: '' }
    case 'ticket':
      return { headline: 'Tickets', sub: 'Secure checkout via PayHere' }
    case 'schedule':
      return { items: [{ time: '09:00', title: 'Doors', detail: '' }] }
    case 'speakers':
      return { people: [{ name: 'Speaker', title: 'Role', image: '' }] }
    case 'sponsors':
      return { logos: [] as string[] }
    case 'faq':
      return { items: [{ q: 'Question?', a: 'Answer.' }] }
    case 'map':
      return { embedUrl: '', height: 320 }
    case 'countdown':
      return { target: new Date(Date.now() + 86400000 * 7).toISOString() }
    case 'social_proof':
      return { quote: 'Amazing experience', author: 'Attendee' }
    case 'custom_html':
      return { html: '<p>Custom HTML</p>' }
    case 'divider':
      return { style: 'line' }
    default:
      return {}
  }
}
