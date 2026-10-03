// Delivery slots and "when should the AI call" rules.
// All wall-clock times are Lagos time (WAT, UTC+1, no daylight saving),
// no matter what timezone the laptop running the dashboard is set to.

import { useEffect, useState } from 'react'
import { parseDate } from './format'

export const LAGOS_TZ = 'Africa/Lagos'
const LAGOS_OFFSET_MS = 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

/** Backend retries a no-answer call this many times in total. Display only. */
export const MAX_ATTEMPTS = 3

export const DELIVERY_SLOTS = [
  { id: '09-12', label: '9am – 12pm', start: '09:00' },
  { id: '12-15', label: '12pm – 3pm', start: '12:00' },
  { id: '15-18', label: '3pm – 6pm', start: '15:00' },
  { id: '18-21', label: '6pm – 9pm', start: '18:00' },
] as const

export const CALL_PLANS = [
  { id: '2h_before', label: '2 hours before delivery' },
  { id: '1h_before', label: '1 hour before delivery' },
  { id: '30m_before', label: '30 minutes before delivery' },
  { id: 'morning_of', label: 'Morning of delivery (8:00 am)' },
  { id: 'day_before', label: 'Evening before (6:00 pm)' },
  { id: 'now', label: 'Right away' },
] as const

export const DEFAULT_PLAN = '2h_before'

export function planLabel(id: string | null | undefined): string {
  return CALL_PLANS.find((p) => p.id === id)?.label ?? (id || '—')
}

/** Lagos date "YYYY-MM-DD" + time "HH:MM" -> real moment in time. */
export function lagosToDate(date: string, time: string): Date | null {
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const t = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!d || !t) return null
  const ms = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]) - LAGOS_OFFSET_MS
  return new Date(ms)
}

/** The Lagos calendar date ("YYYY-MM-DD") of a moment. */
export function lagosDateString(d: Date): string {
  return new Date(d.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10)
}

/** Lagos hour (0-23) right now. */
function lagosHour(d: Date): number {
  return new Date(d.getTime() + LAGOS_OFFSET_MS).getUTCHours()
}

/**
 * When the AI should call for a delivery starting at `deliveryAt`.
 * If that moment has already passed, the AI calls right away (`late` = true).
 */
export function computeCallAt(deliveryAt: Date, plan: string, now = new Date()): { callAt: Date; late: boolean } {
  let t: Date
  switch (plan) {
    case 'now':
      return { callAt: now, late: false }
    case '30m_before':
      t = new Date(deliveryAt.getTime() - 30 * MINUTE)
      break
    case '1h_before':
      t = new Date(deliveryAt.getTime() - HOUR)
      break
    case 'morning_of': {
      t = lagosToDate(lagosDateString(deliveryAt), '08:00')!
      // Early-morning delivery: call an hour before instead
      if (t.getTime() > deliveryAt.getTime() - HOUR) t = new Date(deliveryAt.getTime() - HOUR)
      break
    }
    case 'day_before':
      t = lagosToDate(lagosDateString(new Date(deliveryAt.getTime() - 24 * HOUR)), '18:00')!
      break
    case '2h_before':
    default:
      t = new Date(deliveryAt.getTime() - 2 * HOUR)
  }
  return t.getTime() < now.getTime() ? { callAt: now, late: true } : { callAt: t, late: false }
}

/** A good default delivery date + slot: the next slot at least 2 hours away. */
export function defaultDelivery(now = new Date()): { date: string; slot: string } {
  const today = lagosDateString(now)
  const hour = lagosHour(now)
  const slot = DELIVERY_SLOTS.find((s) => parseInt(s.start) >= hour + 2)
  if (slot) return { date: today, slot: slot.id }
  return { date: lagosDateString(new Date(now.getTime() + 24 * HOUR)), slot: DELIVERY_SLOTS[0].id }
}

/** "Sat 4 Oct" in Lagos time. */
export function lagosDayLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { timeZone: LAGOS_TZ, weekday: 'short', day: 'numeric', month: 'short' })
}

export function lagosTimeLabel(d: Date): string {
  return d.toLocaleTimeString('en-US', { timeZone: LAGOS_TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

/** "Today, 1:00 pm" / "Tomorrow, 9:00 am" / "Sat 4 Oct, 9:00 am" in Lagos time. */
export function friendlyWhen(value: string | Date | null | undefined, now = new Date()): string {
  const d = value instanceof Date ? value : parseDate(value)
  if (!d) return '—'
  const day = lagosDateString(d)
  const prefix =
    day === lagosDateString(now)
      ? 'Today'
      : day === lagosDateString(new Date(now.getTime() + 24 * HOUR))
        ? 'Tomorrow'
        : day === lagosDateString(new Date(now.getTime() - 24 * HOUR))
          ? 'Yesterday'
          : lagosDayLabel(d)
  return `${prefix}, ${lagosTimeLabel(d)}`
}

/** "in 25 min" / "in 3 h" / "due now". */
export function countdown(value: string | null | undefined, now = new Date()): string {
  const d = parseDate(value)
  if (!d) return ''
  const mins = Math.round((d.getTime() - now.getTime()) / MINUTE)
  if (mins <= 0) return 'due now'
  if (mins < 60) return `in ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `in ${hours} h ${mins % 60 ? `${mins % 60} min` : ''}`.trim()
  const days = Math.round(hours / 24)
  return `in ${days} day${days === 1 ? '' : 's'}`
}

/** The text the AI will say, e.g. "Sat 4 Oct, 12pm – 3pm". */
export function deliveryWindowText(date: Date, windowLabel: string): string {
  return `${lagosDayLabel(date)}, ${windowLabel}`
}

/** Accepts "2026-10-04", "04/10/2026" or "4/10/2026" (day first, as in Nigeria). */
export function parseDeliveryDate(input: string): string | null {
  const s = input.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/** Accepts "14:00", "9:30", "2pm", "2:30 pm". Returns "HH:MM" (24h) or null. */
export function parseTime(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '')
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/)
  if (!m) return null
  let h = +m[1]
  const min = m[2] ? +m[2] : 0
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Re-render every `ms` so countdowns stay fresh. */
export function useNow(ms = 30000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
