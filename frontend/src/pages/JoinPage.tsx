import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatPhone, toE164 } from '../lib/phone'
import { PhoneIcon } from '../components/Icons'
import { Spinner } from '../components/States'

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
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-accent-50 to-white px-5 py-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-600 text-white shadow-lg shadow-accent-600/30">
          <PhoneIcon className="h-8 w-8" />
        </div>

        {doneFor ? (
          <div className="animate-slide-in">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Your phone should ring in a few seconds. 📞</h1>
            <p className="mt-4 text-xl text-slate-600">
              We're calling <span className="font-semibold text-slate-900">{formatPhone(doneFor)}</span>. Pick up to chat with our AI. You can speak
              English, Pidgin, Yorùbá, Hausa or Igbo.
            </p>
            <button
              onClick={() => {
                setDoneFor(null)
                setPhone('+234 ')
                setName('')
              }}
              className="mt-8 text-lg font-semibold text-accent-600 underline"
            >
              Use a different number
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Get a call from our AI in seconds</h1>
            <p className="mt-4 text-xl text-slate-600">Enter your number and we'll ring you right away.</p>

            <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
              <label className="block">
                <span className="mb-2 block text-base font-semibold text-slate-700">Phone number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 803 123 4567"
                  className="w-full rounded-2xl border-0 bg-white px-5 py-4 text-2xl font-semibold tracking-wide ring-2 ring-slate-200 focus:outline-none focus:ring-accent-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-base font-semibold text-slate-700">
                  Your name <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Ada"
                  className="w-full rounded-2xl border-0 bg-white px-5 py-4 text-xl ring-2 ring-slate-200 focus:outline-none focus:ring-accent-500"
                />
              </label>

              {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-base font-medium text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={sending}
                className="mt-2 flex items-center justify-center gap-3 rounded-2xl bg-accent-600 px-6 py-5 text-2xl font-bold text-white shadow-lg shadow-accent-600/30 transition hover:bg-accent-700 disabled:opacity-60"
              >
                {sending ? <Spinner className="h-6 w-6" /> : <PhoneIcon className="h-6 w-6" />}
                {sending ? 'Calling…' : 'Call me'}
              </button>
              <p className="text-center text-sm text-slate-500">By tapping “Call me” you agree to receive a call from our AI assistant.</p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
