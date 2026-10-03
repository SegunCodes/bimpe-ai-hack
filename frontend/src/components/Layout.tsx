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
  { href: '/', label: 'Orders' },
  { href: '/customers', label: 'Customers' },
  { href: '/calls', label: 'Live Calls' },
]

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { online, mockMode, checked } = useHealth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-b from-accent-500 to-accent-700 text-white shadow-md shadow-accent-600/30">
              <PhoneIcon className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-extrabold tracking-tight">Bimpe</div>
              <div className="text-xs font-medium text-slate-500">AI delivery calls · Lagos</div>
            </div>
          </Link>

          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {tabs.map((t) => {
              const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`btn relative whitespace-nowrap rounded-xl px-4 py-2 text-base font-semibold ${
                    active ? 'text-accent-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {/* The highlight slides from the old tab to the new one */}
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-accent-50 ring-1 ring-accent-100"
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
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 ring-1 ring-amber-300">Demo mode</span>
            )}
            {checked && (
              <span
                className={`badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                  online ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-800 ring-red-200'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                  <span className={`relative h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </span>
                {online ? 'Live' : 'Offline'}
              </span>
            )}
            <a href="/join" target="_blank" rel="noreferrer" className="btn btn-ghost hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 md:inline">
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
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, tone = 'text-slate-900' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-extrabold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}
