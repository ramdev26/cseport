import { lazy, Suspense, type CSSProperties } from 'react'
import type { BuilderBlock } from '@/types/blocks'
import { cn } from '@/lib/utils'

const CustomHtmlBlock = lazy(async () => ({
  default: function CustomHtmlBlockInner({ html }: { html: string }) {
    return <div className="prose prose-zinc max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
  },
}))

function alignClass(align: unknown): string {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

export function EventRenderer({ blocks }: { blocks: BuilderBlock[] }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 lg:max-w-4xl">
      {blocks.map((b) => (
        <Block key={b.id} block={b} />
      ))}
    </div>
  )
}

function Block({ block }: { block: BuilderBlock }) {
  const p = block.props
  switch (block.type) {
    case 'hero': {
      const align = alignClass(p.align)
      return (
        <section className={cn('rounded-3xl bg-white p-10 shadow-sm ring-1 ring-zinc-900/5', align)}>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Event</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            {String(p.title ?? '')}
          </h1>
          <p className="mt-4 text-lg text-zinc-600">{String(p.subtitle ?? '')}</p>
        </section>
      )
    }
    case 'text':
      return (
        <div className={cn('rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-900/5', alignClass(p.align))}>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-700">{String(p.body ?? '')}</p>
        </div>
      )
    case 'image': {
      const src = String(p.src ?? '')
      if (!src) return <Placeholder label="Image" />
      return (
        <figure className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-900/5">
          <img src={src} alt={String(p.alt ?? '')} className="max-h-[480px] w-full object-cover" loading="lazy" />
          {p.caption ? <figcaption className="px-6 py-3 text-sm text-zinc-500">{String(p.caption)}</figcaption> : null}
        </figure>
      )
    }
    case 'gallery': {
      const images = Array.isArray(p.images) ? (p.images as string[]) : []
      if (!images.length) return <Placeholder label="Gallery" />
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((src, i) => (
            <img key={i} src={src} alt="" className="aspect-square rounded-xl object-cover" loading="lazy" />
          ))}
        </div>
      )
    }
    case 'video': {
      const url = String(p.url ?? '')
      if (!url) return <Placeholder label="Video" />
      return (
        <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-zinc-900/10">
          <iframe title="video" src={url} className="h-full w-full" allowFullScreen />
        </div>
      )
    }
    case 'ticket':
      return (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-zinc-900">{String(p.headline ?? 'Tickets')}</h2>
          <p className="mt-2 text-zinc-600">{String(p.sub ?? '')}</p>
        </div>
      )
    case 'schedule': {
      const items = Array.isArray(p.items) ? (p.items as { time?: string; title?: string; detail?: string }[]) : []
      return (
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-900/5">
          <h2 className="text-xl font-semibold">Schedule</h2>
          <ul className="mt-6 space-y-4">
            {items.map((it, i) => (
              <li key={i} className="flex gap-4 border-b border-zinc-100 pb-4 last:border-0">
                <span className="w-20 shrink-0 text-sm font-medium text-primary">{it.time}</span>
                <div>
                  <p className="font-medium text-zinc-900">{it.title}</p>
                  {it.detail ? <p className="text-sm text-zinc-600">{it.detail}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )
    }
    case 'speakers': {
      const people = Array.isArray(p.people)
        ? (p.people as { name?: string; title?: string; image?: string }[])
        : []
      return (
        <div className="grid gap-6 sm:grid-cols-2">
          {people.map((sp, i) => (
            <div key={i} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-900/5">
              {sp.image ? (
                <img src={sp.image} alt="" className="mb-4 h-16 w-16 rounded-full object-cover" loading="lazy" />
              ) : (
                <div className="mb-4 h-16 w-16 rounded-full bg-zinc-100" />
              )}
              <p className="font-semibold">{sp.name}</p>
              <p className="text-sm text-zinc-600">{sp.title}</p>
            </div>
          ))}
        </div>
      )
    }
    case 'sponsors': {
      const logos = Array.isArray(p.logos) ? (p.logos as string[]) : []
      return (
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-900/5">
          <h2 className="text-center text-lg font-semibold">Sponsors</h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-80">
            {logos.map((src, i) => (
              <img key={i} src={src} alt="Sponsor" className="h-10 object-contain" loading="lazy" />
            ))}
          </div>
        </div>
      )
    }
    case 'faq': {
      const items = Array.isArray(p.items) ? (p.items as { q?: string; a?: string }[]) : []
      return (
        <div className="space-y-4">
          {items.map((it, i) => (
            <details key={i} className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/5 open:ring-primary/20">
              <summary className="cursor-pointer list-none font-medium text-zinc-900 marker:hidden [&::-webkit-details-marker]:hidden">
                {it.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">{it.a}</p>
            </details>
          ))}
        </div>
      )
    }
    case 'map': {
      const embedUrl = String(p.embedUrl ?? '')
      const h = Number(p.height ?? 320)
      if (!embedUrl) return <Placeholder label="Map" />
      return (
        <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-zinc-900/10" style={{ height: h } as CSSProperties}>
          <iframe title="map" src={embedUrl} className="h-full w-full border-0" loading="lazy" />
        </div>
      )
    }
    case 'countdown': {
      const target = String(p.target ?? '')
      return <Countdown target={target} />
    }
    case 'social_proof':
      return (
        <blockquote className="rounded-2xl bg-zinc-900 px-8 py-10 text-lg text-white shadow-lg">
          <p className="font-medium leading-relaxed">“{String(p.quote ?? '')}”</p>
          <footer className="mt-4 text-sm text-zinc-300">— {String(p.author ?? '')}</footer>
        </blockquote>
      )
    case 'custom_html':
      return (
        <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />}>
          <CustomHtmlBlock html={String(p.html ?? '')} />
        </Suspense>
      )
    case 'divider':
      return <hr className="border-zinc-200" />
    default:
      return null
  }
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-400">
      {label} — add content in the builder
    </div>
  )
}

function Countdown({ target }: { target: string }) {
  const t = Date.parse(target)
  const invalid = Number.isNaN(t)
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-900/5">
      <p className="text-sm font-medium text-zinc-500">Countdown</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">
        {invalid ? 'Set a date in the builder' : new Date(t).toLocaleString()}
      </p>
    </div>
  )
}
