import type React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { API_URL } from '../lib/api'
import { useHealth } from '../hooks/useHealth'
import { PhoneIcon } from './Icons'

const tabs = [
  { to: '/', label: 'Orders', end: true },
  { to: '/customers', label: 'Customers' },
  { to: '/calls', label: 'Live Calls' },
]

export function Layout() {
  const { online, mockMode, checked } = useHealth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-600 text-white">
              <PhoneIcon className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-extrabold tracking-tight">Bimpe</div>
              <div className="text-xs font-medium text-slate-500">AI delivery calls · Lagos</div>
            </div>
          </div>

          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-xl px-4 py-2 text-base font-semibold transition-colors ${
                    isActive ? 'bg-accent-50 text-accent-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {mockMode && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 ring-1 ring-amber-300">Demo mode</span>
            )}
            {checked && (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                  online ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-800 ring-red-200'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {online ? 'Live' : 'Offline'}
              </span>
            )}
            <a href="/join" target="_blank" rel="noreferrer" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 md:inline">
              Signup page ↗
            </a>
          </div>
        </div>
      </header>

      {checked && !online && (
        <div className="bg-red-600 px-4 py-3 text-center text-base font-semibold text-white">
          Can't reach the backend at {API_URL}. Start the backend server, and this page will reconnect on its own.
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
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
