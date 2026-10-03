'use client'

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatPhone, toE164 } from '../lib/phone'
import { PhoneIcon } from '../components/Icons'
import { EASE_OUT } from '../components/Overlay'
import { Spinner } from '../components/States'

// First-time page: the one place in the product with a delight budget.
const container: Variants = {
  show: { transition: { staggerChildren: 0.06 } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } },
}
const item: Variants = {
  hidden: { opacity: 0, transform: 'translateY(10px)' },
  show: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.4, ease: EASE_OUT } },
}

function RingingPhone() {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
      className="relative mb-8 flex h-20 w-20 items-center justify-center"
    >
      {/* Soft rings pulsing out, like a phone ringing */}
      {!reduce &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-[28px] bg-emerald-400"
            initial={{ opacity: 0.35, transform: 'scale(1)' }}
            animate={{ opacity: 0, transform: 'scale(1.6)' }}
            transition={{ duration: 1.6, ease: EASE_OUT, repeat: Infinity, delay: 0.4 + i * 0.8 }}
          />
        ))}
      <motion.div
        className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-600/30"
        animate={reduce ? undefined : { rotate: [0, -14, 14, -10, 10, -4, 0] }}
        transition={{ duration: 0.7, ease: 'easeInOut', delay: 0.35, repeat: 2, repeatDelay: 0.9 }}
      >
        <PhoneIcon className="h-9 w-9" />
      </motion.div>
    </motion.div>
  )
}

export function JoinPage() {
  const [phone, setPhone] = useState('+234 ')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneFor, setDoneFor] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const e164 = toE164(phone)
    if (!e164) return setError('Please enter a valid phone number, e.g. 0803 123 4567.')
    setSending(true)
    try {
      await api.publicSignup({ phone: e164, name: name.trim() || undefined })
      setDoneFor(e164)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-accent-50 via-white to-white px-5 py-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <AnimatePresence mode="wait" initial={true}>
          {doneFor ? (
            <motion.div key="done" variants={container} initial="hidden" animate="show" exit="exit">
              <RingingPhone />
              <motion.h1 variants={item} className="text-4xl font-extrabold leading-tight tracking-tight">
                Your phone should ring in a few seconds.
              </motion.h1>
              <motion.p variants={item} className="mt-4 text-xl text-slate-600">
                We&apos;re calling <span className="font-semibold text-slate-900">{formatPhone(doneFor)}</span>. Pick up to chat with our AI. You can
                speak English, Pidgin, Yorùbá, Hausa or Igbo.
              </motion.p>
              <motion.button
                variants={item}
                onClick={() => {
                  setDoneFor(null)
                  setPhone('+234 ')
                  setName('')
                }}
                className="btn btn-ghost -ml-3 mt-8 rounded-xl px-3 py-2 text-lg font-semibold text-accent-600"
              >
                ← Use a different number
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="form" variants={container} initial="hidden" animate="show" exit="exit">
              <motion.div
                variants={item}
                className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-b from-accent-500 to-accent-700 text-white shadow-lg shadow-accent-600/30"
              >
                <PhoneIcon className="h-8 w-8" />
              </motion.div>
              <motion.h1 variants={item} className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Get a call from our AI in seconds
              </motion.h1>
              <motion.p variants={item} className="mt-4 text-xl text-slate-600">
                Enter your number and we&apos;ll ring you right away.
              </motion.p>

              <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
                <motion.label variants={item} className="block">
                  <span className="mb-2 block text-base font-semibold text-slate-700">Phone number</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 803 123 4567"
                    className="w-full rounded-2xl border-0 bg-white px-5 py-4 text-2xl font-semibold tracking-wide shadow-sm ring-2 ring-slate-200 transition-shadow duration-200 focus:outline-none focus:ring-accent-500"
                  />
                </motion.label>
                <motion.label variants={item} className="block">
                  <span className="mb-2 block text-base font-semibold text-slate-700">
                    Your name <span className="font-normal text-slate-400">(optional)</span>
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Ada"
                    className="w-full rounded-2xl border-0 bg-white px-5 py-4 text-xl shadow-sm ring-2 ring-slate-200 transition-shadow duration-200 focus:outline-none focus:ring-accent-500"
                  />
                </motion.label>

                <AnimatePresence initial={false}>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, transform: 'translateY(-4px)' }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      className="rounded-2xl bg-red-50 px-4 py-3 text-base font-medium text-red-700"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.div variants={item}>
                  <button
                    type="submit"
                    disabled={sending}
                    className="btn btn-primary mt-2 flex h-16 w-full items-center justify-center gap-3 rounded-2xl px-6 text-2xl font-bold text-white disabled:opacity-60"
                  >
                    {sending ? <Spinner className="h-6 w-6" /> : <PhoneIcon className="h-6 w-6" />}
                    {sending ? 'Calling…' : 'Call me'}
                  </button>
                </motion.div>
                <motion.p variants={item} className="text-center text-sm text-slate-500">
                  By tapping “Call me” you agree to receive a call from our AI assistant.
                </motion.p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
