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
]

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { online, mockMode, checked } = useHealth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-ink text-white shadow-[0_8px_24px_-12px_rgb(11_18_32/0.6)]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danfo text-ink">
              <PhoneIcon className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-xl font-bold tracking-tight text-white">Tellero</div>
              <div className="text-xs font-medium text-white/55">AI delivery calls · Lagos</div>
            </div>
          </Link>

          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {tabs.map((t) => {
              const active = t.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`btn relative whitespace-nowrap rounded-xl px-4 py-2 text-base font-semibold ${
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
              <span className="rounded-full bg-danfo/15 px-3 py-1 text-sm font-bold text-danfo ring-1 ring-danfo/40">Demo mode</span>
            )}
            {checked && (
              <span
                className={`badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                  online ? 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30' : 'bg-red-500/20 text-red-200 ring-red-400/40'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                  <span className={`relative h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
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
        <div className="bg-red-600 px-4 py-3 text-center text-base font-semibold text-white">
          Can&apos;t reach the backend at {API_URL}. Start the backend server, and this page will reconnect on its own.
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-base text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, tone = 'text-slate-900' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-ink/10">
      <div className="text-sm font-semibold text-ink-soft">{label}</div>
      <div className={`mt-1 font-display text-4xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}
