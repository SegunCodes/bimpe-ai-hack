'use client'
import type React from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EASE_IN_OUT, EASE_OUT, Segmented } from '../Overlay'
import { StatusBadge } from '../StatusBadge'
import { SCENARIOS, type CardState } from './scenarios'

type Phase = 'idle' | 'ringing' | 'live' | 'ended'

interface Line {
  who: 'agent' | 'customer'
  text: string
  /** How many characters are visible (typewriter for the agent) */
  shown: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function useTypewriter(text: string, active: boolean, speed = 24) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    let i = 0
    const t = setInterval(() => {
      i++
      setN(i)
      if (i >= text.length) clearInterval(t)
    }, speed)
    return () => clearInterval(t)
  }, [text, active, speed])
  return active ? text.slice(0, n) : ''
}

/** The address "rewrites itself": old line gets struck through, the clean one types in underneath. */
function AddressSwap({ from, to }: { from: string; to?: string }) {
  const reduce = useReducedMotion()
  const typed = useTypewriter(to ?? '', !!to && !reduce, 28)
  const text = reduce ? to : typed
  return (
    <div className="min-h-[3.25rem]">
      <span className={`relative inline transition-colors duration-300 ${to ? 'text-ink-soft/50' : 'text-ink'}`}>
        {from}
        {to && (
          <motion.span
            aria-hidden
            className="absolute inset-x-0 top-1/2 h-[2px] origin-left rounded bg-red-500/80"
            initial={{ transform: 'scaleX(0)' }}
            animate={{ transform: 'scaleX(1)' }}
            transition={{ duration: 0.35, ease: EASE_IN_OUT }}
          />
        )}
      </span>
      {to && (
        <div className="mt-1 font-semibold text-ink">
          {text}
          {!reduce && typed.length < (to?.length ?? 0) && <span className="caret" />}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, highlight }: { label: string; value?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 transition-colors duration-500 ${highlight ? 'bg-danfo-soft' : ''}`}>
      <dt className="text-xs font-semibold text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-[15px] text-ink">{value || <span className="text-ink-soft/50">—</span>}</dd>
    </div>
  )
}

export function CallSimulator() {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [lines, setLines] = useState<Line[]>([])
  const [typing, setTyping] = useState<'agent' | 'customer' | null>(null)
  const [card, setCard] = useState<CardState>(SCENARIOS[0].start)
  const [changed, setChanged] = useState<string[]>([])
  const [seconds, setSeconds] = useState(0)
  const runId = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const scenario = SCENARIOS[index]

  const play = useCallback(
    async (i: number) => {
      const id = ++runId.current
      const alive = () => runId.current === id
      const s = SCENARIOS[i]
      setIndex(i)
      setLines([])
      setTyping(null)
      setChanged([])
      setSeconds(0)
      setCard(s.start)
      setPhase('ringing')
      await sleep(reduce ? 300 : 1400)
      if (!alive()) return
      setPhase('live')
      setCard((c) => ({ ...c, status: 'calling' }))

      for (const turn of s.turns) {
        if (!alive()) return
        if (turn.who === 'customer') {
          setTyping('customer')
          await sleep(reduce ? 200 : 750)
          if (!alive()) return
          setTyping(null)
          setLines((l) => [...l, { who: 'customer', text: turn.text, shown: turn.text.length }])
          await sleep(reduce ? 900 : 650)
        } else {
          setTyping('agent')
          await sleep(reduce ? 100 : 350)
          if (!alive()) return
          setTyping(null)
          if (reduce) {
            setLines((l) => [...l, { who: 'agent', text: turn.text, shown: turn.text.length }])
            await sleep(1100)
          } else {
            setLines((l) => [...l, { who: 'agent', text: turn.text, shown: 0 }])
            for (let c = 1; c <= turn.text.length; c += 2) {
              if (!alive()) return
              setLines((l) => l.map((ln, k) => (k === l.length - 1 ? { ...ln, shown: Math.min(c + 1, ln.text.length) } : ln)))
              await sleep(26)
            }
            await sleep(500)
          }
        }
        if (!alive()) return
        if (turn.patch) {
          setCard((c) => ({ ...c, ...turn.patch }))
          setChanged(Object.keys(turn.patch).filter((k) => k !== 'status'))
        }
      }
      if (!alive()) return
      setPhase('ended')
    },
    [reduce],
  )

  // Start the first call once the section scrolls into view
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true
          play(0)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      runId.current++ // cancel any running call on unmount
    }
  }, [play])

  // Call timer
  useEffect(() => {
    if (phase !== 'live') return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  // Keep the newest line in view, inside the transcript box only (never scroll the page)
  useEffect(() => {
    const box = scrollRef.current
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [lines, typing, reduce])

  const live = phase === 'live'
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  const isOnboarding = scenario.kind === 'Onboarding'

  return (
    <div ref={rootRef}>
      <Segmented
        id="mk-scenario"
        className="mx-auto max-w-2xl"
        value={scenario.id}
        onChange={(id) => play(SCENARIOS.findIndex((s) => s.id === id))}
        options={SCENARIOS.map((s) => ({ value: s.id, label: s.tab }))}
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Call panel */}
        <div className="flex min-h-[30rem] flex-col overflow-hidden rounded-[28px] bg-ink text-white shadow-[0_30px_70px_-35px_rgb(11_18_32/0.8)]">
          <div className="flex items-center gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-danfo font-display text-lg font-bold text-ink">
              T
              {phase === 'ringing' && !reduce && (
                <span className="absolute inset-0 animate-ping rounded-2xl bg-danfo/60" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                Tellero AI → {scenario.customer} <span className="font-normal text-white/50">· {scenario.language}</span>
              </p>
              <p className="text-sm text-white/60" aria-live="polite">
                {phase === 'idle' && 'Ready'}
                {phase === 'ringing' && 'Ringing…'}
                {phase === 'live' && `On the call · ${mmss}`}
                {phase === 'ended' && `Call ended · ${mmss}`}
              </p>
            </div>
            <div className="flex h-8 items-center gap-[3px]" data-live={live} aria-hidden>
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} className="wave-bar h-full w-[3px] rounded-full bg-danfo" style={{ ['--i' as string]: i }} />
              ))}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-6" style={{ maxHeight: '26rem' }}>
            <AnimatePresence initial={false}>
              {lines.map((l, k) => (
                <motion.div
                  key={`${scenario.id}-${k}`}
                  initial={{ opacity: 0, transform: 'translateY(8px) scale(0.98)' }}
                  animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className={`flex ${l.who === 'agent' ? 'justify-start' : 'justify-end'}`}
                >
                  <p
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed sm:text-base ${
                      l.who === 'agent' ? 'rounded-tl-md bg-white/10 text-white' : 'rounded-tr-md bg-danfo text-ink'
                    }`}
                  >
                    {l.text.slice(0, l.shown)}
                    {l.shown < l.text.length && <span className="caret" />}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
            {typing === 'customer' && (
              <div className="flex justify-end" aria-hidden>
                <span className="flex gap-1 rounded-2xl rounded-tr-md bg-danfo/90 px-4 py-3.5">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/60" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </span>
              </div>
            )}
            {phase === 'idle' && <p className="pt-24 text-center text-white/50">The call starts when you scroll here.</p>}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 sm:px-6">
            <p className="text-sm text-white/50">Sample call · names and numbers are made up</p>
            <button
              onClick={() => play(index)}
              className="btn rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              ↻ Replay
            </button>
          </div>
        </div>

        {/* Order card, the same fields the dashboard shows */}
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-ink/10 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-soft">{isOnboarding ? 'New customer' : 'Order'}</p>
              <p className="font-display text-2xl font-bold tracking-tight text-ink">{isOnboarding ? scenario.customer : scenario.item}</p>
              {!isOnboarding && <p className="text-ink-soft">for {scenario.customer} · {scenario.seller}</p>}
            </div>
            <motion.div key={card.status} initial={{ opacity: 0, transform: 'scale(0.9)' }} animate={{ opacity: 1, transform: 'scale(1)' }} transition={{ duration: 0.25, ease: EASE_OUT }}>
              <StatusBadge status={card.status} size="lg" />
            </motion.div>
          </div>

          <div className="my-5 border-t border-dashed border-ink/15" />

          <dl className="grid gap-1">
            <Field label="Phone" value={scenario.phone} />
            {!isOnboarding && <Field label="Delivery" value={scenario.window} />}
            <Field
              label={isOnboarding ? 'Address' : 'Address on file → cleaned by Tellero AI'}
              value={<AddressSwap key={scenario.id} from={card.address} to={card.cleanAddress} />}
              highlight={changed.includes('cleanAddress')}
            />
            <Field label="Landmark" value={card.landmark} highlight={changed.includes('landmark')} />
            {isOnboarding ? (
              <>
                <Field label="Language" value={card.language} highlight={changed.includes('language')} />
                <Field label="Best time to call" value={card.bestTime} highlight={changed.includes('bestTime')} />
                <Field label="Consent to calls" value={card.consent} highlight={changed.includes('consent')} />
              </>
            ) : (
              <Field label="Notes" value={card.note} highlight={changed.includes('note')} />
            )}
          </dl>

          <AnimatePresence>
            {phase === 'ended' && (
              <motion.p
                initial={{ opacity: 0, transform: 'translateY(6px)' }}
                animate={{ opacity: 1, transform: 'translateY(0px)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-[15px] font-medium text-emerald-900 ring-1 ring-emerald-200"
              >
                ✓ Saved to the dashboard with the transcript. Nobody had to pick up a phone.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
