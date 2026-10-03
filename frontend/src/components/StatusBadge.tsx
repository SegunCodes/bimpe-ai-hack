import { humanize } from '../lib/format'

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'purple' | 'orange' | 'red'

// One place for every status color, so badges look the same everywhere.
const STATUS: Record<string, { tone: Tone; live?: boolean }> = {
  // orders
  pending: { tone: 'gray' },
  calling: { tone: 'blue', live: true },
  confirmed: { tone: 'green' },
  rescheduled: { tone: 'amber' },
  address_updated: { tone: 'purple' },
  no_answer: { tone: 'orange' },
  failed: { tone: 'red' },
  // customers
  new: { tone: 'gray' },
  called: { tone: 'blue' },
  verified: { tone: 'green' },
  // calls
  queued: { tone: 'gray' },
  initiated: { tone: 'blue', live: true },
  ringing: { tone: 'blue', live: true },
  in_progress: { tone: 'blue', live: true },
  'in-progress': { tone: 'blue', live: true },
  ongoing: { tone: 'blue', live: true },
  active: { tone: 'blue', live: true },
  completed: { tone: 'green' },
  ended: { tone: 'green' },
  onboarded: { tone: 'green' },
  busy: { tone: 'orange' },
  voicemail: { tone: 'orange' },
  declined: { tone: 'red' },
  error: { tone: 'red' },
}

const TONES: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-300',
  blue: 'bg-blue-100 text-blue-800 ring-blue-300',
  green: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  amber: 'bg-amber-100 text-amber-900 ring-amber-300',
  purple: 'bg-purple-100 text-purple-800 ring-purple-300',
  orange: 'bg-orange-100 text-orange-800 ring-orange-300',
  red: 'bg-red-100 text-red-800 ring-red-300',
}

const DOTS: Record<Tone, string> = {
  gray: 'bg-slate-400',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
}

export function StatusBadge({ status, size = 'md' }: { status: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (!status) return <span className="text-slate-400">—</span>
  const key = status.toLowerCase()
  const { tone, live } = STATUS[key] ?? { tone: 'gray' as Tone }
  const sizes = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-3 py-1 gap-2',
    lg: 'text-base px-4 py-1.5 gap-2',
  }
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${TONES[tone]} ${sizes[size]}`}>
      <span className="relative flex h-2 w-2">
        {live && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${DOTS[tone]}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${DOTS[tone]}`} />
      </span>
      {humanize(status)}
    </span>
  )
}
