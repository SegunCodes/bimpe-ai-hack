'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { setToken } from '../lib/session'
import { Button } from './Button'
import { PhoneIcon } from './Icons'
import { inputClass } from './Overlay'

/** Full-page sign-in shown instead of the dashboard until the right password is entered. */
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null)

  useEffect(() => {
    api
      .authStatus()
      .then((s) => setPasswordSet(s.passwordSet))
      .catch(() => setPasswordSet(null))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return setError('Enter the dashboard password.')
    setBusy(true)
    setError(null)
    try {
      const { token } = await api.login(password)
      setToken(token)
      onSignedIn()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danfo text-ink">
            <PhoneIcon className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-[-0.02em] text-white">Tellero dashboard</h1>
          <p className="mt-1.5 text-base text-white/60">Enter the password to see orders, customers and calls.</p>
        </div>

        {passwordSet === false ? (
          <div className="rounded-3xl bg-white p-5 text-[15px] leading-relaxed text-ink-soft sm:p-6">
            <p className="font-semibold text-ink">The password hasn’t been set up yet.</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5">
              <li>Open your backend project on Vercel.</li>
              <li>
                Go to Settings → Environment Variables and add <code className="rounded bg-mist px-1.5 py-0.5 text-sm text-ink">ADMIN_PASSWORD</code> with a long password.
              </li>
              <li>Redeploy the backend, then refresh this page.</li>
            </ol>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-3xl bg-white p-5 sm:p-6">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            {error && <p className="mt-3 rounded-xl bg-bad-soft px-4 py-2.5 text-sm font-medium text-bad">{error}</p>}
            <Button type="submit" variant="brand" size="lg" loading={busy} className="mt-4 w-full">
              Sign in
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-white/45">
          <a href="/" className="underline underline-offset-4 hover:text-white/70">
            Back to the website
          </a>
        </p>
      </div>
    </div>
  )
}
