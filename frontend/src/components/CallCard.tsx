import type React from 'react'
import type { Call } from '../lib/types'
import { formatDateTime, formatDuration, humanize, isActiveCall } from '../lib/format'
import { StatusBadge } from './StatusBadge'
import { Transcript } from './Transcript'

/** extracted_json may arrive as JSON text (per the contract) or as an already-parsed object. */
function parseExtracted(json: unknown): [string, string][] {
  if (!json) return []
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json
    if (!data || typeof data !== 'object') return []
    return Object.entries(data)
      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
      .map(([k, v]) => [humanize(k), typeof v === 'object' ? JSON.stringify(v) : String(v)])
  } catch {
    return []
  }
}

export function CallCard({ call, highlight }: { call: Call; highlight?: boolean }) {
  const extracted = parseExtracted(call.extracted_json)
  return (
    <article className={`rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/10 sm:p-6 ${highlight ? 'animate-flash' : ''}`}>
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-ink px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
          {call.call_type === 'onboarding' ? 'Onboarding' : 'Delivery'}
        </span>
        <StatusBadge status={call.status} />
        {call.outcome && <StatusBadge status={call.outcome} />}
        <span className="w-full text-sm text-ink-muted sm:ml-auto sm:w-auto">
          {formatDateTime(call.created_at)} · {formatDuration(call.duration_seconds)}
        </span>
      </header>

      {isActiveCall(call.status) && !call.transcript && (
        <p className="mb-3 text-base font-medium text-ink-soft">Call in progress… transcript will appear when it ends.</p>
      )}

      {call.recording_url && (
        <audio controls preload="none" src={call.recording_url} className="mb-4 w-full">
          Your browser can't play this recording.
        </audio>
      )}

      <Transcript text={call.transcript} />

      {extracted.length > 0 && (
        <details className="mt-4 rounded-2xl bg-paper p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink-soft">What Tellero AI noted</summary>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {extracted.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{k}</dt>
                <dd className="break-words text-sm text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  )
}

export function CallHistory({ calls }: { calls: Call[] }) {
  return (
    <section>
      <h3 className="mb-3 text-lg font-bold text-ink">Call history ({calls.length})</h3>
      {calls.length === 0 ? (
        <p className="rounded-3xl bg-white p-6 text-base text-ink-muted ring-1 ring-ink/10">No calls yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {calls.map((c) => (
            <CallCard key={c.id} call={c} />
          ))}
        </div>
      )}
    </section>
  )
}

export function InfoItem({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 text-base text-ink">{value || <span className="text-ink-faint">—</span>}</dd>
    </div>
  )
}
