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
    <div className="flex items-center justify-center gap-3 py-16 text-lg text-ink-muted">
      <Spinner className="h-6 w-6 text-accent-600" />
      {label}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-2xl text-ink-faint">∅</div>
      <p className="text-xl font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-md text-base text-ink-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-bad-soft text-2xl text-bad">!</div>
      <p className="text-xl font-semibold text-ink">We couldn't load this</p>
      <p className="max-w-md text-base text-ink-muted">{message}</p>
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
    <div className="mb-4 flex items-center gap-2 rounded-xl bg-danfo-soft px-4 py-2.5 text-sm font-medium text-ink ring-1 ring-danfo/60">
      <Spinner className="h-4 w-4" />
      Reconnecting… showing the last data we received. ({message})
    </div>
  )
}
