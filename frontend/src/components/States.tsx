import type { ReactNode } from 'react'

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-lg text-slate-500">
      <Spinner className="h-6 w-6 text-accent-600" />
      {label}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">∅</div>
      <p className="text-xl font-semibold text-slate-800">{title}</p>
      {hint && <p className="max-w-md text-base text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-500">!</div>
      <p className="text-xl font-semibold text-slate-800">We couldn't load this</p>
      <p className="max-w-md text-base text-slate-500">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary mt-4 h-12 rounded-xl bg-white px-5 text-base font-semibold">
          Try again
        </button>
      )}
    </div>
  )
}

/** Small banner shown above data when a background refresh fails but we still have old data. */
export function StaleBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
      <Spinner className="h-4 w-4" />
      Reconnecting… showing the last data we received. ({message})
    </div>
  )
}
