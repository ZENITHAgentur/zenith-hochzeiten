import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-3xl font-bold text-ink tracking-widest">ZENITH</span>
          </div>
          <p className="text-sm text-muted">Fotobox-Dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-hairline p-8">
          <h2 className="font-semibold text-base text-ink mb-6">Anmelden</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-Mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@zenith-agentur.de"
              required
              autoComplete="email"
              autoFocus
            />
            <Input
              label="Passwort"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            {error && (
              <p className="text-sm text-status-red bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full justify-center py-2.5"
            >
              Anmelden
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
