'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { API_URL } from '../lib/api'
import { useHealth } from '../hooks/useHealth'
import { PhoneIcon } from './Icons'
import { EASE_IN_OUT } from './Overlay'

const tabs = [
  { href: '/dashboard', label: 'Orders' },
  { href: '/dashboard/customers', label: 'Customers' },
  { href: '/dashboard/calls', label: 'Live Calls' },
  { href: '/dashboard/admin', label: 'Admin' },
]

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { online, mockMode, checked } = useHealth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-ink text-white shadow-[0_8px_24px_-12px_rgb(11_18_32/0.6)]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-danfo text-ink sm:h-10 sm:w-10">
              <PhoneIcon className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">Tellero</div>
              <div className="hidden text-xs font-medium text-white/55 sm:block">AI delivery calls · Lagos</div>
            </div>
          </Link>

          <nav className="order-last grid w-full grid-cols-4 gap-1 rounded-2xl bg-white/[0.06] p-1 sm:order-none sm:flex sm:w-auto sm:bg-transparent sm:p-0">
            {tabs.map((t) => {
              const active = t.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`btn relative whitespace-nowrap rounded-xl px-0.5 py-2 text-center text-[13px] font-semibold tracking-[-0.01em] sm:px-4 sm:text-base ${
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
              <span className="whitespace-nowrap rounded-full bg-danfo/15 px-3 py-1 text-xs font-bold text-danfo ring-1 ring-danfo/40 sm:text-sm">Demo<span className="hidden sm:inline"> mode</span></span>
            )}
            {checked && (
              <span
                className={`badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 sm:text-sm ${
                  online ? 'bg-white/10 text-white ring-white/15' : 'bg-bad text-white ring-bad'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ccf86] opacity-60" />}
                  <span className={`relative h-2 w-2 rounded-full ${online ? 'bg-[#3ccf86]' : 'bg-white'}`} />
                </span>
                {online ? 'Live' : 'Offline'}
              </span>
            )}
            <Link href="/" className="btn hidden rounded-xl px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white md:inline">
              Website
            </Link>
            <a href="/join" target="_blank" rel="noreferrer" className="btn hidden rounded-xl px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white md:inline">
              Signup page ↗
            </a>
          </div>
        </div>
      </header>

      {checked && !online && (
        <div className="bg-bad px-4 py-3 text-center text-base font-semibold text-white">
          Can&apos;t reach the backend at {API_URL}. Start the backend server, and this page will reconnect on its own.
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-8 sm:py-8">{children}</main>
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
