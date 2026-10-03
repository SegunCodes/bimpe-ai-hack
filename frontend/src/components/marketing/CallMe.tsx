'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../../lib/api'
import { formatPhone, toE164 } from '../../lib/phone'
import { EASE_OUT } from '../Overlay'
import { PhoneIcon } from '../Icons'

type State = 'idle' | 'sending' | 'done'

const LABELS: Record<State, string> = { idle: 'Call me now', sending: 'Dialling…', done: 'Ringing your phone' }

/** The button label rolls: each new label drops in from the top while the old one leaves downward. */
function RollingLabel({ state }: { state: State }) {
  return (
    <span className="relative grid overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={state}
          className="col-start-1 row-start-1 whitespace-nowrap"
          initial={{ opacity: 0, transform: 'translateY(-100%)', filter: 'blur(2px)' }}
          animate={{ opacity: 1, transform: 'translateY(0%)', filter: 'blur(0px)' }}
          exit={{ opacity: 0, transform: 'translateY(100%)', filter: 'blur(2px)' }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          {LABELS[state]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export function CallMe() {
  const [phone, setPhone] = useState('+234 ')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)
  const [called, setCalled] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const e164 = toE164(phone)
    if (!e164) return setError('That number doesn’t look right. Try 0803 123 4567.')
    setState('sending')
    try {
      await api.publicSignup({ phone: e164 })
      setCalled(e164)
      setState('done')
    } catch (err) {
      setState('idle')
      setError(`We couldn’t place the call: ${errorMessage(err)}`)
    }
  }

  return (
    <section id="call-me" className="scroll-mt-20 px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-ink px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <h2 className="font-display text-4xl font-bold tracking-[-0.02em] sm:text-6xl">Hear it on your own phone.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">Enter a Nigerian number and Tellero will call you in a few seconds. It takes about a minute.</p>

        <form onSubmit={submit} className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="callme-phone">
            Phone number
          </label>
          <input
            id="callme-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            disabled={state !== 'idle'}
            onChange={(e) => setPhone(e.target.value)}
            className="h-14 min-w-0 flex-1 rounded-full border-0 bg-white/10 px-6 text-xl font-semibold tracking-wide text-white ring-1 ring-white/20 transition-shadow duration-200 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-danfo disabled:opacity-60"
            placeholder="+234 803 123 4567"
          />
          <button
            type="submit"
            disabled={state !== 'idle'}
            className="btn btn-danfo inline-flex h-14 items-center justify-center gap-2.5 rounded-full px-7 text-lg font-bold disabled:cursor-default"
          >
            <PhoneIcon className={`h-5 w-5 ${state === 'done' ? 'origin-center animate-[ring_0.9s_ease-in-out_infinite]' : ''}`} />
            <RollingLabel state={state} />
          </button>
        </form>

        <div className="mx-auto mt-4 min-h-[1.75rem] max-w-xl" aria-live="polite">
          {error && <p className="text-base font-medium text-red-300">{error}</p>}
          {state === 'done' && (
            <p className="text-base text-white/80">
              Your phone should ring in a few seconds: {formatPhone(called)}.{' '}
              <button
                className="font-semibold text-danfo underline underline-offset-4"
                onClick={() => {
                  setState('idle')
                  setPhone('+234 ')
                }}
              >
                Use another number
              </button>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
