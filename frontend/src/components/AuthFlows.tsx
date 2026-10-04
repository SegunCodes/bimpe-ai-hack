'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { clearToken, getToken, setToken } from '../lib/session'
import type { Business } from '../lib/types'
import { AuthFrame } from './AuthCard'
import { Button } from './Button'
import { CodeInput } from './CodeInput'
import { inputClass } from './Overlay'
import { Spinner } from './States'

/** Counts down from `seconds` after each send, so "send a new code" can't be spammed. */
function useCooldown() {
  const [wait, setWait] = useState(0)
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])
  return [wait, setWait] as const
}

/**
 * Step two of sign-up: confirm the email with the 6-digit code before the dashboard opens.
 * Also where log-in sends anyone whose email isn't confirmed yet.
 */
export function VerifyEmail() {
  const router = useRouter()
  const [business, setBusiness] = useState<Business | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [wait, setWait] = useCooldown()

  useEffect(() => {
    if (!getToken('business')) {
      router.replace('/login')
      return
    }
    api
      .me()
      .then((b) => {
        if (b.emailVerified) router.replace('/dashboard/onboarding')
        else setBusiness(b)
      })
      .catch(() => router.replace('/login'))
  }, [router])

  const verify = async (code: string) => {
    setBusy(true)
    setError(null)
    try {
      await api.verifyEmail(code)
      // Carry a plan picked on the pricing section through to setup.
      const plan = new URLSearchParams(window.location.search).get('plan')
      router.replace(`/dashboard/onboarding${plan && /^[a-z_]+$/.test(plan) ? `?plan=${plan}` : ''}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }
  const resend = async () => {
    setError(null)
    setNote(null)
    try {
      await api.resendCode()
      setNote('New code sent. Check your inbox and spam folder.')
      setWait(60)
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  const useAnotherEmail = () => {
    clearToken('business')
    router.replace('/signup')
  }

  return (
    <AuthFrame title="Check your email" subtitle="One last step before your dashboard.">
      <div className="rounded-3xl bg-white p-5 sm:p-6">
        {!business ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6 text-ink" />
          </div>
        ) : (
          <>
            <p className="mb-4 text-[15px] text-ink-soft">
              We sent a 6-digit code to <span className="font-semibold text-ink">{business.email}</span>. It expires in 15 minutes.
            </p>
            <CodeInput onComplete={verify} busy={busy} />
            <div className="mt-3 min-h-6 text-sm" aria-live="polite">
              {busy && (
                <span className="inline-flex items-center gap-2 text-ink-soft">
                  <Spinner className="h-4 w-4" /> Checking…
                </span>
              )}
              {error && <span className="font-medium text-bad">{error}</span>}
              {note && !error && <span className="text-good">{note}</span>}
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              No email?{' '}
              <button onClick={resend} disabled={wait > 0} className="font-semibold text-ink underline-offset-4 hover:underline disabled:text-ink-muted disabled:no-underline">
                {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
              </button>
            </p>
          </>
        )}
      </div>
      <p className="mt-6 text-center text-[15px] text-white/60">
        Wrong email?{' '}
        <button onClick={useAnotherEmail} className="font-semibold text-danfo underline-offset-4 hover:underline">
          Sign up again
        </button>
      </p>
    </AuthFrame>
  )
}

/** Forgotten password: email → 6-digit code + new password → signed in. */
export function ResetPassword() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useCooldown()

  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the email you signed up with.')
    setBusy(true)
    try {
      await api.forgotPassword(email.trim())
      setStep('code')
      setWait(60)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const reset = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (code.length !== 6) return setError('Enter the 6-digit code from the email.')
    if (password.length < 8) return setError('Use a new password of at least 8 characters.')
    setBusy(true)
    try {
      const { token, business } = await api.resetPassword({ email: email.trim(), code, password })
      setToken('business', token)
      router.replace(business.verification.status === 'approved' ? '/dashboard' : '/dashboard/onboarding')
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthFrame
      title="Reset your password"
      subtitle={step === 'email' ? 'We’ll email you a code to choose a new one.' : `If ${email.trim()} has an account, a code is on its way.`}
      footer={
        <>
          Remembered it?{' '}
          <Link href="/login" className="font-semibold text-danfo underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {step === 'email' ? (
        <form onSubmit={requestCode} className="flex flex-col gap-4 rounded-3xl bg-white p-5 sm:p-6" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Email</span>
            <input type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>
          {error && <p className="rounded-xl bg-bad-soft px-4 py-2.5 text-sm font-medium text-bad">{error}</p>}
          <Button type="submit" variant="brand" size="lg" loading={busy} className="w-full">
            Email me a code
          </Button>
        </form>
      ) : (
        <form onSubmit={reset} className="flex flex-col gap-4 rounded-3xl bg-white p-5 sm:p-6" noValidate>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">6-digit code</span>
            <CodeInput onChange={setCode} busy={false} keepValue />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">New password</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <span className="mt-1 block text-sm text-ink-muted">At least 8 characters.</span>
          </label>
          {error && <p className="rounded-xl bg-bad-soft px-4 py-2.5 text-sm font-medium text-bad">{error}</p>}
          <Button type="submit" variant="brand" size="lg" loading={busy} className="w-full">
            Save new password
          </Button>
          <p className="text-center text-sm text-ink-muted">
            No email?{' '}
            <button type="button" onClick={() => requestCode()} disabled={wait > 0} className="font-semibold text-ink underline-offset-4 hover:underline disabled:text-ink-muted disabled:no-underline">
              {wait > 0 ? `Send again in ${wait}s` : 'Send again'}
            </button>
          </p>
        </form>
      )}
    </AuthFrame>
  )
}
