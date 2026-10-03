/** SQLite-style timestamps ("2026-10-03 14:05:00") have no timezone; treat them as UTC. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  let s = value.trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s += 'Z'
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export function formatDateTime(value: string | null | undefined): string {
  const d = parseDate(value)
  if (!d) return value || '—'
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function timeAgo(value: string | null | undefined): string {
  const d = parseDate(value)
  if (!d) return ''
  const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return formatDateTime(value)
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const LANGUAGES: Record<string, string> = {
  en: 'English',
  pcm: 'Pidgin',
  yo: 'Yorùbá',
  ha: 'Hausa',
  ig: 'Igbo',
}

export function languageName(code: string | null | undefined): string {
  if (!code) return '—'
  return LANGUAGES[code] || code
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  const s = value.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Newest first, by created_at then id. */
export function newestFirst<T extends { id: number; created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = parseDate(a.created_at)?.getTime() ?? 0
    const tb = parseDate(b.created_at)?.getTime() ?? 0
    return tb - ta || b.id - a.id
  })
}

const ACTIVE_CALL_STATUSES = ['calling', 'queued', 'initiated', 'ringing', 'in_progress', 'in-progress', 'ongoing', 'active']
export function isActiveCall(status: string | null | undefined): boolean {
  return !!status && ACTIVE_CALL_STATUSES.includes(status.toLowerCase())
}
