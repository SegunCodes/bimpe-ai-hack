'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api, errorMessage } from '../lib/api'
import { getToken, setToken } from '../lib/session'
import { Button } from './Button'
import { PhoneIcon } from './Icons'
import { inputClass } from './Overlay'

/** Ink page with the Tellero AI mark and a white card: shared by sign up, log in and admin sign-in. */
export function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="Tellero AI home" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danfo text-ink">
            <PhoneIcon className="h-6 w-6" />
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-[-0.02em] text-white">{title}</h1>
          <p className="mt-1.5 text-base text-white/60">{subtitle}</p>
        </div>
        {children}
        {footer && <div className="mt-6 text-center text-[15px] text-white/60">{footer}</div>}
      </div>
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-ink-muted">{hint}</span>}
    </label>
  )
}

/** Business sign up / log in. New businesses go straight to choosing a plan. */
export function BusinessAuth({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'

  // Already signed in on this browser: skip the form.
  useEffect(() => {
    if (getToken('business')) router.replace('/dashboard')
  }, [router])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (signup && name.trim().length < 2) return setError('Enter your business name.')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.')
    if (signup && password.length < 8) return setError('Use a password of at least 8 characters.')
    if (!password) return setError('Enter your password.')
    setBusy(true)
    try {
      const { token } = signup
        ? await api.signup({ business_name: name.trim(), email: email.trim(), password })
        : await api.login({ email: email.trim(), password })
      setToken('business', token)
      const next = new URLSearchParams(window.location.search).get('next')
      const plan = new URLSearchParams(window.location.search).get('plan')
      const chosen = plan && /^[a-z_]+$/.test(plan) ? `&plan=${plan}` : ''
      router.push(signup ? `/dashboard/billing?welcome=1${chosen}` : next && next.startsWith('/dashboard') ? next : '/dashboard')
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthFrame
      title={signup ? 'Start with Tellero AI' : 'Welcome back'}
      subtitle={signup ? 'Create your business account. Tellero AI calls your customers before every delivery.' : 'Log in to your business dashboard.'}
      footer={
        signup ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-danfo underline-offset-4 hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to Tellero AI?{' '}
            <Link href="/signup" className="font-semibold text-danfo underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        )
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-white p-5 sm:p-6" noValidate>
        {signup && (
          <Field label="Business name">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" className={inputClass} placeholder="e.g. Ada Fabrics" />
          </Field>
        )}
        <Field label="Email">
          <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Password" hint={signup ? 'At least 8 characters.' : undefined}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signup ? 'new-password' : 'current-password'}
            className={inputClass}
          />
        </Field>
        {error && <p className="rounded-xl bg-bad-soft px-4 py-2.5 text-sm font-medium text-bad">{error}</p>}
        <Button type="submit" variant="brand" size="lg" loading={busy} className="w-full">
          {signup ? 'Create account' : 'Log in'}
        </Button>
        {signup && (
          <p className="text-center text-sm text-ink-muted">
            By creating an account you agree to the{' '}
            <Link href="/terms" className="font-semibold text-ink underline-offset-4 hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-semibold text-ink underline-offset-4 hover:underline">
              Privacy policy
            </Link>
            .
          </p>
        )}
      </form>
    </AuthFrame>
  )
}
