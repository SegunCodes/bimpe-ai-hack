'use client'

import { useState } from 'react'
import { CALL_PLANS, DELIVERY_SLOTS, computeCallAt, lagosDateString, lagosTimeLabel, lagosToDate, planLabel } from '../../lib/schedule'
import { Segmented } from '../Overlay'

const RULES = CALL_PLANS.filter((p) => p.id !== 'now')
const HOUR = 3600_000

/** Interactive version of the real scheduling rule the dashboard uses. */
export function SchedulePlayground() {
  const [slotId, setSlotId] = useState<string>('12-15')
  const [plan, setPlan] = useState<string>('2h_before')

  // A fixed example day so the demo never depends on "now"
  const day = lagosDateString(new Date(Date.UTC(2026, 9, 6, 12)))
  const prevDay = lagosDateString(new Date(Date.UTC(2026, 9, 5, 12)))
  const slot = DELIVERY_SLOTS.find((s) => s.id === slotId)!
  const deliveryAt = lagosToDate(day, slot.start)!
  const slotEnd = new Date(deliveryAt.getTime() + 3 * HOUR)
  const { callAt } = computeCallAt(deliveryAt, plan, new Date(0))

  // Track: 5pm the evening before → 10pm delivery day
  const start = lagosToDate(prevDay, '17:00')!.getTime()
  const end = lagosToDate(day, '22:00')!.getTime()
  const pct = (t: number) => ((t - start) / (end - start)) * 100
  const midnight = pct(lagosToDate(day, '00:00')!.getTime())
  const six = pct(lagosToDate(day, '06:00')!.getTime())

  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-ink/10 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">Delivery slot</p>
          <Segmented
            id="mk-slot"
            value={slotId}
            onChange={setSlotId}
            options={DELIVERY_SLOTS.map((s) => ({ value: s.id, label: s.label.replace(' – ', '–') }))}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">When should Tellero call?</p>
          <div className="flex flex-wrap gap-2">
            {RULES.map((r) => (
              <button
                key={r.id}
                onClick={() => setPlan(r.id)}
                aria-pressed={plan === r.id}
                className={`btn rounded-full px-3.5 py-2 text-sm font-semibold ${plan === r.id ? 'btn-ink' : 'btn-secondary bg-white text-ink'}`}
              >
                {r.label.replace(' delivery', '').replace(' (8:00 am)', '').replace(' (6:00 pm)', '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative mt-10 h-24 select-none overflow-x-clip" aria-hidden>
        <div className="absolute inset-x-0 top-10 h-3 overflow-hidden rounded-full bg-paper">
          <div className="absolute inset-y-0 bg-ink/[0.06]" style={{ left: `${midnight}%`, width: `${six - midnight}%` }} />
        </div>
        {/* delivery slot block: left/width transition because the pill genuinely changes span; a scaleX would distort its rounded ends */}
        <div
          className="absolute top-8 h-7 rounded-lg bg-indigo-500/90 transition-[left,width] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
          style={{ left: `${pct(deliveryAt.getTime())}%`, width: `${pct(slotEnd.getTime()) - pct(deliveryAt.getTime())}%` }}
        />
        {/* call marker: a full-width wrapper translated by a percentage of the track */}
        <div
          className="absolute inset-x-0 top-0 h-full transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
          style={{ transform: `translateX(${pct(callAt.getTime())}%)` }}
        >
          <div className="absolute left-0 top-0 flex -translate-x-1/2 flex-col items-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-danfo text-ink shadow-md ring-4 ring-white">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
              </svg>
            </span>
            <span className="mt-1 h-6 w-0.5 bg-danfo" />
          </div>
        </div>
        <div className="absolute inset-x-0 top-[3.75rem] flex justify-between text-xs font-medium text-ink-soft/70">
          <span>
            5pm<span className="hidden sm:inline">, day before</span>
          </span>
          <span className="hidden sm:inline" style={{ position: 'absolute', left: `${midnight}%`, transform: 'translateX(-50%)' }}>
            Midnight
          </span>
          <span>10pm</span>
        </div>
      </div>

      <p className="mt-2 text-lg text-ink sm:text-xl" aria-live="polite">
        Delivery <span className="font-semibold">{slot.label}</span>. Tellero calls at{' '}
        <span className="rounded-md bg-danfo-soft px-1.5 font-bold">
          {lagosTimeLabel(callAt)}
          {lagosDateString(callAt) !== day ? ' the evening before' : ''}
        </span>{' '}
        <span className="text-ink-soft">({planLabel(plan).toLowerCase()})</span>. If nobody picks up, it tries again twice, 30 minutes apart.
      </p>
    </div>
  )
}
