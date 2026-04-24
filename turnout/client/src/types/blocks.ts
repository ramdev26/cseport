export const BLOCK_TYPES = [
  'hero',
  'text',
  'image',
  'gallery',
  'video',
  'ticket',
  'schedule',
  'speakers',
  'sponsors',
  'faq',
  'map',
  'countdown',
  'social_proof',
  'custom_html',
  'divider',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export type BuilderBlock = {
  id: string
  type: BlockType
  props: Record<string, unknown>
}

export type PageSchema = {
  version: number
  blocks: BuilderBlock[]
}

export function defaultSchema(): PageSchema {
  return {
    version: 1,
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'hero',
        props: {
          title: 'Your event title',
          subtitle: 'Tagline or date',
          align: 'center',
        },
      },
    ],
  }
}
