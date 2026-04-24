import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

export function AttendeeLoginPage() {
  const nav = useNavigate()
  const refresh = useAuthStore((s) => s.refresh)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Attendee login</CardTitle>
          <CardDescription>Access your tickets and leave reviews after attending.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              try {
                await apiFetch('/api/auth/login.php', {
                  method: 'POST',
                  body: JSON.stringify({ email, password }),
                })
                await refresh()
                nav('/attendee/tickets')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Login failed')
              }
            }}
          >
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-500">
            Need an account?{' '}
            <Link className="font-medium text-primary hover:underline" to="/attendee/register">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
