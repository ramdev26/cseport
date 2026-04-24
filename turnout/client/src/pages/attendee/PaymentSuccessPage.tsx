import { useSearchParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const reg = params.get('registration_id')

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Payment received</CardTitle>
          <CardDescription>
            PayHere will confirm on the server. Your ticket email arrives shortly after notify succeeds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reg ? (
            <p className="text-sm text-zinc-600">
              Reference: <span className="font-mono text-xs text-zinc-900">{reg}</span>
            </p>
          ) : null}
          <Button asChild className="w-full">
            <Link to="/attendee/tickets">View tickets</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
