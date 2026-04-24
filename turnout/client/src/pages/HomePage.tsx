import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">TurnOut</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
          Events deserve their own mini‑site.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-600">
          Build a beautiful landing page for every event, sell tickets with PayHere, and host everything on a single slug
          like <span className="font-mono text-zinc-900">/e/your-event</span>.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/organizer/register">Create as organizer</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/attendee/discover">Browse events</Link>
          </Button>
        </div>
      </div>

      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        {[
          {
            title: 'Page builder',
            body: 'Drag blocks, undo/redo, autosave, and publish when you are ready.',
          },
          {
            title: 'PayHere',
            body: 'Server verified notify URL. Amounts stored as LKR integers.',
          },
          {
            title: 'cPanel friendly',
            body: 'React build in public_html with PHP APIs under /api.',
          },
        ].map((c) => (
          <Card key={c.title} className="border-zinc-200/80">
            <CardHeader>
              <CardTitle className="text-base">{c.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">{c.body}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  )
}
