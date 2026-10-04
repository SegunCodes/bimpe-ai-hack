'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { setToken } from '../lib/session'
import { AuthFrame } from './AuthCard'
import { Button } from './Button'
import { inputClass } from './Overlay'

/** The platform owner's sign-in for /admin, using ADMIN_PASSWORD from the backend's settings. */
export function AdminSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null)

  useEffect(() => {
    api
      .adminStatus()
      .then((s) => setPasswordSet(s.passwordSet))
      .catch(() => setPasswordSet(null))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return setError('Enter the admin password.')
    setBusy(true)
    setError(null)
    try {
      const { token } = await api.adminLogin(password)
      setToken('admin', token)
      onSignedIn()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthFrame title="Tellero admin" subtitle="Every business, every call. For the Tellero team only.">
      {passwordSet === false ? (
        <div className="rounded-3xl bg-white p-5 text-[15px] leading-relaxed text-ink-soft sm:p-6">
          <p className="font-semibold text-ink">The admin password hasn’t been set up yet.</p>
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
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Admin password</span>
            <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </label>
          {error && <p className="mt-3 rounded-xl bg-bad-soft px-4 py-2.5 text-sm font-medium text-bad">{error}</p>}
          <Button type="submit" variant="brand" size="lg" loading={busy} className="mt-4 w-full">
            Sign in
          </Button>
        </form>
      )}
    </AuthFrame>
  )
}
