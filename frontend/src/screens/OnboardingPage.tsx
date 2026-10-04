'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatDateTime } from '../lib/format'
import type { Business } from '../lib/types'
import { useBusiness } from '../hooks/useBusiness'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { CheckIcon, UploadIcon } from '../components/Icons'
import { PageHeader } from '../components/Layout'
import { LoadingState, Spinner } from '../components/States'

type StepState = 'done' | 'current' | 'waiting'

function Step({ n, title, state, children }: { n: number; title: string; state: StepState; children?: ReactNode }) {
  return (
    <li className={`rounded-3xl bg-white p-5 ring-1 sm:p-6 ${state === 'current' ? 'ring-ink/25' : 'ring-ink/10'}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            state === 'done' ? 'bg-good text-white' : state === 'current' ? 'bg-ink text-white' : 'bg-mist text-ink-muted'
          }`}
        >
          {state === 'done' ? <CheckIcon className="h-4 w-4" /> : n}
        </span>
        <h2 className={`font-display text-xl font-bold ${state === 'waiting' ? 'text-ink-muted' : 'text-ink'}`}>{title}</h2>
      </div>
      {children && <div className="mt-4 sm:pl-11">{children}</div>}
    </li>
  )
}

/** Six boxes; the code is checked as soon as the sixth digit lands (typed or pasted). */
function CodeInput({ onComplete, busy }: { onComplete: (code: string) => void; busy: boolean }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const update = (next: string[]) => {
    setDigits(next)
    if (next.every((d) => d !== '')) onComplete(next.join(''))
  }
  const onChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    if (!value) return
    const next = [...digits]
    // Typing (or autofill) can deliver several digits at once: spread them forward.
    value.split('').forEach((d, k) => {
      if (i + k < 6) next[i + k] = d
    })
    update(next)
    refs.current[Math.min(5, i + value.length)]?.focus()
  }
  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      if (next[i]) next[i] = ''
      else if (i > 0) {
        next[i - 1] = ''
        refs.current[i - 1]?.focus()
      }
      setDigits(next)
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    const next = Array(6).fill('').map((_, k) => pasted[k] ?? '')
    update(next)
    refs.current[Math.min(5, pasted.length)]?.focus()
  }

  // Clear the boxes after a wrong code so they can type again.
  useEffect(() => {
    if (!busy && digits.every((d) => d !== '')) {
      const t = setTimeout(() => {
        setDigits(Array(6).fill(''))
        refs.current[0]?.focus()
      }, 600)
      return () => clearTimeout(t)
    }
  }, [busy]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex gap-2 sm:gap-3" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={d}
          onChange={(e) => onChange(i, e)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          disabled={busy}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1}`}
          className="h-14 w-11 rounded-xl bg-paper text-center font-display text-2xl font-bold text-ink ring-1 ring-inset ring-ink/20 focus:outline-none focus:ring-2 focus:ring-ink disabled:opacity-60 sm:w-12"
        />
      ))}
    </div>
  )
}

function EmailStep({ business, onDone }: { business: Business; onDone: () => Promise<void> }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const verify = async (code: string) => {
    setBusy(true)
    setError(null)
    try {
      await api.verifyEmail(code)
      toast.success('Email confirmed')
      await onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const resend = async () => {
    setError(null)
    try {
      await api.resendCode()
      toast.success(`New code sent to ${business.email}`)
      setWait(60)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
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
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        No email? Check spam, or{' '}
        <button onClick={resend} disabled={wait > 0} className="font-semibold text-ink underline-offset-4 hover:underline disabled:text-ink-muted disabled:no-underline">
          {wait > 0 ? `send a new code in ${wait}s` : 'send a new code'}
        </button>
        .
      </p>
    </>
  )
}

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const MAX_BYTES = 4 * 1024 * 1024

function DocumentStep({ business, onDone }: { business: Business; onDone: () => Promise<void> }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const v = business.verification

  const send = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!ACCEPT.split(',').includes(file.type)) return setError('Upload a PDF, JPG, PNG or WebP file.')
    if (file.size > MAX_BYTES) return setError('That file is too big. The limit is 4 MB.')
    setBusy(true)
    try {
      await api.uploadDocument(file)
      toast.success('Certificate uploaded. We’ll email you once it’s reviewed.')
      await onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    send(e.dataTransfer.files[0])
  }

  return (
    <>
      {v.status === 'rejected' && (
        <p className="mb-4 rounded-2xl bg-bad-soft px-4 py-3 text-[15px] text-bad">
          <span className="font-semibold">We couldn’t approve your last upload.</span> {v.note}
        </p>
      )}
      <p className="mb-4 text-[15px] text-ink-soft">
        Upload your CAC registration certificate (business name or company). A clear PDF, or a photo where every word is readable, up to 4 MB.
      </p>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ${
          dragging ? 'border-ink bg-danfo-soft' : 'border-ink/20 bg-paper hover:border-ink/40'
        }`}
      >
        {busy ? <Spinner className="h-6 w-6 text-ink" /> : <UploadIcon className="h-6 w-6 text-ink" />}
        <span className="text-base font-semibold text-ink">{busy ? 'Uploading…' : 'Choose a file or drop it here'}</span>
        <span className="text-sm text-ink-muted">PDF, JPG, PNG or WebP · up to 4 MB</span>
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => send(e.target.files?.[0])} />
      </label>
      {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
    </>
  )
}

function ReviewStep({ business }: { business: Business }) {
  const v = business.verification
  const [opening, setOpening] = useState(false)
  const open = async () => {
    setOpening(true)
    try {
      window.open(await api.myDocument(), '_blank', 'noopener')
    } finally {
      setOpening(false)
    }
  }
  if (v.status === 'approved') {
    return (
      <>
        <p className="text-[15px] text-ink-soft">
          <span className="font-semibold text-good">Approved.</span> {business.name} is verified. Choose a plan and Tellero AI can start calling your customers.
        </p>
        <Link href="/dashboard/billing" className="btn btn-danfo mt-4 inline-flex h-12 items-center rounded-full px-6 text-base font-bold">
          Choose a plan
        </Link>
      </>
    )
  }
  return (
    <>
      <p className="text-[15px] text-ink-soft">
        We’re checking your certificate against the CAC register. This usually takes less than one working day, and we’ll email you either way.
      </p>
      {v.document && (
        <p className="mt-3 text-sm text-ink-muted">
          Uploaded{' '}
          <button onClick={open} disabled={opening} className="font-semibold text-ink underline-offset-4 hover:underline">
            {v.document.filename}
          </button>{' '}
          · {formatDateTime(v.document.uploadedAt)}
        </p>
      )}
      <p className="mt-4 text-[15px] text-ink-soft">
        While you wait, you can{' '}
        <Link href="/dashboard/customers" className="font-semibold text-ink underline-offset-4 hover:underline">
          add customers
        </Link>{' '}
        and{' '}
        <Link href="/dashboard" className="font-semibold text-ink underline-offset-4 hover:underline">
          orders
        </Link>
        .
      </p>
    </>
  )
}

function Steps() {
  const { business, refresh } = useBusiness()
  const params = useSearchParams()
  if (!business) return <LoadingState label="Loading your account…" />

  const emailDone = business.emailVerified
  const status = business.verification.status
  const docDone = emailDone && (status === 'pending' || status === 'approved')
  const approved = status === 'approved'
  const picked = params.get('plan')

  return (
    <>
      <PageHeader
        title={approved ? 'You’re all set' : 'Set up your account'}
        subtitle={
          approved
            ? 'Your business is verified.'
            : 'Three quick steps so we know you’re a real, registered business. Your customers trust calls that come from verified sellers.'
        }
      />
      <ol className="flex max-w-3xl flex-col gap-3">
        <Step n={1} title="Confirm your email" state={emailDone ? 'done' : 'current'}>
          {!emailDone && <EmailStep business={business} onDone={refresh} />}
        </Step>
        <Step n={2} title="Upload your CAC certificate" state={docDone ? 'done' : emailDone ? 'current' : 'waiting'}>
          {emailDone && !docDone && <DocumentStep business={business} onDone={refresh} />}
        </Step>
        <Step n={3} title={approved ? 'Approved' : 'We review it'} state={approved ? 'done' : docDone ? 'current' : 'waiting'}>
          {docDone && <ReviewStep business={business} />}
        </Step>
      </ol>
      {approved && picked && (
        <p className="mt-4 text-[15px] text-ink-soft">
          You picked a plan earlier:{' '}
          <Link href={`/dashboard/billing?welcome=1&plan=${encodeURIComponent(picked)}`} className="font-semibold text-ink underline-offset-4 hover:underline">
            continue to payment
          </Link>
          .
        </p>
      )}
    </>
  )
}

export function OnboardingPage() {
  return (
    <Suspense>
      <Steps />
    </Suspense>
  )
}
