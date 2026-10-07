'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useHealth } from '../hooks/useHealth'
import { PhoneIcon, Wordmark } from './Icons'
import { LoadingState } from './States'
import { EASE_IN_OUT } from './Overlay'
import { SIGNED_OUT_EVENT, clearToken, getToken, type SessionKind } from '../lib/session'
import { BusinessProvider, useBusiness } from '../hooks/useBusiness'

const tabs = [
  { href: '/dashboard', label: 'Orders' },
  { href: '/dashboard/customers', label: 'Customers' },
  { href: '/dashboard/calls', label: 'Calls' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/billing', label: 'Plan' },
]

/**
 * Business dashboard frame. Visitors without a session go to the log-in page; the backend
 * checks the session on every request and scopes all data to the signed-in business.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    // Read storage after mount: the server-rendered page can't know about this browser's session.
    if (getToken('business')) setSignedIn(true)
    else router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    const onSignedOut = (e: Event) => {
      if ((e as CustomEvent<SessionKind>).detail === 'business') router.replace('/login')
    }
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [router, pathname])

  if (!signedIn) return <div className="min-h-screen bg-ink" />
  return (
    <BusinessProvider>
      <SignedInShell>{children}</SignedInShell>
    </BusinessProvider>
  )
}

/** Header pill: which plan, and how many calls are left. Links to Plan & billing. */
function PlanPill() {
  const { business } = useBusiness()
  if (!business) return null
  const { active, planName, callsLeft } = business.plan
  const empty = business.plan.outOfCredits
  if (business.verification.status !== 'approved') {
    return (
      <Link href="/dashboard/onboarding" className="btn whitespace-nowrap rounded-full bg-danfo px-3 py-1 text-xs font-semibold text-ink ring-1 ring-danfo sm:text-sm">
        {business.verification.status === 'pending' ? 'In review' : 'Finish setup'}
      </Link>
    )
  }
  return (
    <Link
      href="/dashboard/billing"
      className={`btn whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 sm:text-sm ${
        !active || empty ? 'bg-danfo text-ink ring-danfo' : 'bg-white/10 text-white ring-white/15 hover:bg-white/15'
      }`}
    >
      {!active ? 'Choose a plan' : empty ? 'Top up calls' : (
        <>
          <span className="hidden sm:inline">{planName} · </span>
          {callsLeft} calls left
        </>
      )}
    </Link>
  )
}

/** Shown on every dashboard page (except billing) while calls can't go out. */
function PlanBanner() {
  const { business } = useBusiness()
  const pathname = usePathname()
  if (!business || pathname.startsWith('/dashboard/billing') || pathname.startsWith('/dashboard/onboarding')) return null
  const v = business.verification.status
  if (v !== 'approved') {
    return (
      <div className="bg-danfo-soft px-4 py-3 text-center text-[15px] text-ink ring-1 ring-danfo/50 sm:px-8">
        {v === 'pending' ? (
          <>We’re checking your CAC certificate. Once it’s approved you can choose a plan and start calls. </>
        ) : v === 'rejected' ? (
          <>We couldn’t approve your CAC certificate. Please upload it again. </>
        ) : (
          <>Finish setting up: upload your CAC certificate so we can approve your business. </>
        )}
        {v !== 'pending' && (
          <Link href="/dashboard/onboarding" className="font-semibold underline underline-offset-4">
            {v === 'rejected' ? 'Upload again' : 'Finish setup'}
          </Link>
        )}
      </div>
    )
  }
  const { active, outOfCredits } = business.plan
  if (active && !outOfCredits) return null
  return (
    <div className="bg-danfo-soft px-4 py-3 text-center text-[15px] text-ink ring-1 ring-danfo/50 sm:px-8">
      {active ? (
        <>You’re out of call credits. Scheduled calls are waiting and go out as soon as you top up. </>
      ) : (
        <>Tellero AI can’t call your customers until you choose a plan. You can add orders and customers now. </>
      )}
      <Link href="/dashboard/billing" className="font-semibold underline underline-offset-4">
        {active ? 'Top up now' : 'Choose a plan'}
      </Link>
    </div>
  )
}

function SignedInShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { online, mockMode, checked } = useHealth()
  const { business } = useBusiness()

  // The dashboard opens only once the email is confirmed.
  const needsEmail = business !== null && !business.emailVerified
  useEffect(() => {
    if (needsEmail) router.replace('/verify-email')
  }, [needsEmail, router])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-ink text-white shadow-[0_8px_24px_-12px_rgb(11_18_32/0.6)]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danfo text-ink sm:h-10 sm:w-10">
              <PhoneIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <Wordmark className="text-lg text-white sm:text-xl" />
              <div className="flex max-w-[9rem] items-center gap-1.5 text-xs font-medium text-white/55 sm:max-w-[14rem]">
                {business?.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={business.logoUrl} alt="" className="h-4 w-4 shrink-0 rounded bg-white object-contain" />
                )}
                <span className="truncate">{business?.name ?? ' '}</span>
              </div>
            </div>
          </Link>

          <nav className="order-last grid w-full grid-cols-5 gap-1 rounded-2xl bg-white/[0.06] p-1 sm:order-none sm:flex sm:w-auto sm:bg-transparent sm:p-0">
            {tabs.map((t) => {
              const active = t.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`btn relative whitespace-nowrap rounded-xl px-0 py-2 text-center text-[12px] font-semibold tracking-[-0.01em] sm:px-4 sm:text-base ${
                    active ? 'text-ink' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {/* The highlight slides from the old tab to the new one */}
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-danfo"
                      transition={{ duration: 0.25, ease: EASE_IN_OUT }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {mockMode && (
              <span className="hidden whitespace-nowrap rounded-full bg-danfo/15 px-3 py-1 text-xs font-bold text-danfo ring-1 ring-danfo/40 sm:inline sm:text-sm">Demo mode</span>
            )}
            {checked && !online && <span className="rounded-full bg-bad px-3 py-1 text-xs font-semibold text-white sm:text-sm">Offline</span>}
            <PlanPill />
            <button
              onClick={() => clearToken('business')}
              className="btn rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <PlanBanner />

      {checked && !online && (
        <div className="bg-bad px-4 py-3 text-center text-base font-semibold text-white">
          Can&apos;t reach Tellero AI right now. Check your connection; this page reconnects on its own.
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-8 sm:py-8">{needsEmail ? <LoadingState label="One more step…" /> : children}</main>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-ink-muted sm:text-base">{subtitle}</p>}
      </div>
      {/* Phones: the actions share one full-width row */}
      {actions && <div className="grid w-full auto-cols-fr grid-flow-col gap-2 sm:flex sm:w-auto">{actions}</div>}
    </div>
  )
}

/**
 * Numbers are always ink. Colour only appears as a marker when it means something:
 * a pulsing yellow dot for "live right now", red when a count needs someone's attention.
 */
export function StatCard({ label, value, marker, className = '' }: { label: string; value: number | string; marker?: 'live' | 'attention'; className?: string }) {
  const alert = marker === 'attention' && Number(value) > 0
  const live = marker === 'live' && Number(value) > 0
  return (
    <div className={`rounded-3xl px-4 py-3.5 shadow-sm ring-1 sm:rounded-[28px] sm:px-5 sm:py-4 ${alert ? 'bg-bad-soft ring-bad/20' : 'bg-white ring-ink/10'} ${className}`}>
      <div className={`flex items-center gap-2 text-[13px] font-semibold leading-snug sm:text-sm ${alert ? 'text-bad' : 'text-ink-muted'}`}>
        {live && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danfo" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ink" />
          </span>
        )}
        {label}
      </div>
      <div className={`mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl ${alert ? 'text-bad' : 'text-ink'}`}>{value}</div>
    </div>
  )
}
