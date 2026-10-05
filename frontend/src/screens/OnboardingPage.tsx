'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useRef, useState, type DragEvent, type ReactNode } from 'react'
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

const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp'
const MAX_LOGO_BYTES = 1024 * 1024

/** Optional: the business's logo, shown in its dashboard and to the Tellero AI team. Can be changed any time. */
function LogoStep({ business, onDone }: { business: Business; onDone: () => Promise<void> }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!LOGO_ACCEPT.split(',').includes(file.type)) return setError('Use a PNG, JPG or WebP image.')
    if (file.size > MAX_LOGO_BYTES) return setError('That image is too big. The limit is 1 MB.')
    setBusy('upload')
    try {
      await api.uploadLogo(file)
      toast.success('Logo saved')
      await onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }
  const remove = async () => {
    setBusy('remove')
    setError(null)
    try {
      await api.removeLogo()
      toast.success('Logo removed')
      await onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-paper ring-1 ring-ink/10">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt={`${business.name} logo`} className="h-full w-full object-contain" />
          ) : (
            <span className="font-display text-2xl font-bold text-ink-faint">
              {business.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join('')}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-ink-soft">A square image works best. PNG, JPG or WebP, up to 1 MB.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={`btn btn-secondary inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-ink ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              {busy === 'upload' ? <Spinner className="h-4 w-4" /> : <UploadIcon className="h-4 w-4" />}
              {business.logoUrl ? 'Change logo' : 'Upload logo'}
              <input ref={input} type="file" accept={LOGO_ACCEPT} className="sr-only" disabled={busy !== null} onChange={(e) => send(e.target.files?.[0])} />
            </label>
            {business.logoUrl && (
              <Button size="sm" variant="ghost" onClick={remove} loading={busy === 'remove'} disabled={busy !== null}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
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
            ? 'Your business is verified. You can change your logo here any time.'
            : 'Upload your CAC certificate so we know you’re a real, registered business, and add your logo if you like. Your customers trust calls from verified sellers.'
        }
      />
      <ol className="flex max-w-3xl flex-col gap-3">
        <Step n={1} title="Upload your CAC certificate" state={docDone ? 'done' : emailDone ? 'current' : 'waiting'}>
          {emailDone && !docDone && <DocumentStep business={business} onDone={refresh} />}
        </Step>
        <Step n={2} title="Add your business logo (optional)" state={business.logoUrl ? 'done' : emailDone ? 'current' : 'waiting'}>
          {emailDone && <LogoStep business={business} onDone={refresh} />}
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
