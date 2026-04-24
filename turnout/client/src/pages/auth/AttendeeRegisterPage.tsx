import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

export function AttendeeRegisterPage() {
  const nav = useNavigate()
  const refresh = useAuthStore((s) => s.refresh)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Create attendee account</CardTitle>
          <CardDescription>Join TurnOut to purchase tickets and keep them in one place.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              try {
                await apiFetch('/api/auth/register.php', {
                  method: 'POST',
                  body: JSON.stringify({ full_name: fullName, email, password, role: 'attendee' }),
                })
                await refresh()
                nav('/attendee/discover')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Signup failed')
              }
            }}
          >
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password (min 8)</Label>
              <Input
                id="password"
                type="password"
                className="mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full">
              Sign up
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-500">
            Have an account?{' '}
            <Link className="font-medium text-primary hover:underline" to="/attendee/login">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
