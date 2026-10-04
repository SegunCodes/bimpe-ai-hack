import { humanize } from '../lib/format'

/**
 * Five meanings, each with one look, built only from the brand palette plus green/red:
 *   waiting  – nothing has happened yet (mist)
 *   live     – Tellero AI is on the phone (danfo yellow, pulsing)
 *   done     – it went well (green)
 *   changed  – it went well but something moved: new time or address (ink outline)
 *   attention – a person needs to look at it (red)
 */
type Tone = 'waiting' | 'live' | 'done' | 'changed' | 'attention'

const STATUS: Record<string, Tone> = {
  // orders
  pending: 'waiting',
  scheduled: 'waiting',
  calling: 'live',
  confirmed: 'done',
  rescheduled: 'changed',
  address_updated: 'changed',
  no_answer: 'attention',
  failed: 'attention',
  // customers
  new: 'waiting',
  called: 'waiting',
  verified: 'done',
  // calls
  queued: 'waiting',
  initiated: 'live',
  ringing: 'live',
  in_progress: 'live',
  'in-progress': 'live',
  ongoing: 'live',
  active: 'live',
  completed: 'done',
  ended: 'done',
  onboarded: 'done',
  busy: 'attention',
  voicemail: 'attention',
  declined: 'attention',
  error: 'attention',
}

const TONES: Record<Tone, { badge: string; dot: string }> = {
  waiting: { badge: 'bg-mist text-ink-soft ring-ink/10', dot: 'bg-ink-faint' },
  live: { badge: 'bg-danfo-soft text-ink ring-danfo', dot: 'bg-ink' },
  done: { badge: 'bg-good-soft text-good ring-good/25', dot: 'bg-good' },
  changed: { badge: 'bg-white text-ink ring-ink/25', dot: 'bg-ink' },
  attention: { badge: 'bg-bad-soft text-bad ring-bad/25', dot: 'bg-bad' },
}

export function StatusBadge({ status, size = 'md' }: { status: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (!status) return <span className="text-ink-faint">—</span>
  const tone = STATUS[status.toLowerCase()] ?? 'waiting'
  const sizes = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-3 py-1 gap-2',
    lg: 'text-base px-4 py-1.5 gap-2',
  }
  return (
    <span className={`badge inline-flex items-center whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${TONES[tone].badge} ${sizes[size]}`}>
      <span className="relative flex h-2 w-2">
        {tone === 'live' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danfo opacity-90" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${TONES[tone].dot}`} />
      </span>
      {humanize(status)}
    </span>
  )
}
