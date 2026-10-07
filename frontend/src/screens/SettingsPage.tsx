'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatPhone, toE164 } from '../lib/phone'
import type { CallSettings, Rider } from '../lib/types'
import { useBusiness } from '../hooks/useBusiness'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { BikeIcon, PlusIcon } from '../components/Icons'
import { PageHeader } from '../components/Layout'
import { Field, inputClass } from '../components/Overlay'
import { ErrorState, LoadingState } from '../components/States'

const NOTES_LIMIT = 600

export function SettingsPage() {
  const [settings, setSettings] = useState<CallSettings | null>(null)
  const [riders, setRiders] = useState<Rider[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const [s, r] = await Promise.all([api.callSettings(), api.listRiders()])
      setSettings(s)
      setRiders(r)
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <PageHeader title="Settings" subtitle="How Tellero AI speaks for your business, and the riders who carry your orders." />
      {error && !settings && <ErrorState message={error} onRetry={load} />}
      {!error && !settings && <LoadingState label="Loading settings…" />}
      {settings && riders && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          <IntroCard settings={settings} onSaved={setSettings} />
          <RidersCard settings={settings} onSettings={setSettings} riders={riders} onRiders={setRiders} />
        </div>
      )}
    </>
  )
}

function IntroCard({ settings, onSaved }: { settings: CallSettings; onSaved: (s: CallSettings) => void }) {
  const toast = useToast()
  const { business } = useBusiness()
  const [notes, setNotes] = useState(settings.callNotes)
  const [saving, setSaving] = useState(false)
  const changed = notes.trim() !== settings.callNotes.trim()

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      onSaved(await api.saveCallSettings({ call_notes: notes.trim() }))
      toast.success('Saved. Tellero AI uses this from the next call.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-ink/10 sm:p-6">
      <h2 className="font-display text-xl font-bold text-ink">How Tellero AI opens your calls</h2>
      <p className="mt-1 text-[15px] text-ink-soft">Every call starts by saying who’s calling, for which business, and why.</p>

      <figure className="mt-4 rounded-2xl bg-ink p-4 text-white sm:p-5">
        <figcaption className="text-xs font-semibold uppercase tracking-wide text-danfo">Delivery call</figcaption>
        <blockquote className="mt-1.5 text-base leading-relaxed sm:text-lg">
          “Hi Chidinma, I’m Tellero AI, calling from <span className="font-semibold text-danfo">{business?.name ?? 'your business'}</span> to confirm
          the delivery of your jollof rice tray. Is now a good time?”
        </blockquote>
        <p className="mt-2 text-sm text-white/60">The customer’s name and item fill in from each order.</p>
      </figure>

      <form onSubmit={save} className="mt-5 flex flex-col gap-3">
        <Field
          label="What Tellero AI can tell your customers"
          hint="Delivery fee, delivery days, areas you cover, how to pay. If a customer asks something that isn’t here, Tellero AI says you’ll get back to them and notes the question on the call."
        >
          <textarea
            className={inputClass}
            rows={4}
            maxLength={NOTES_LIMIT}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery is ₦1,500 on the Island and ₦2,000 on the Mainland. We deliver Monday to Saturday. Pay on delivery by transfer."
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink-faint">
            {notes.length}/{NOTES_LIMIT}
          </span>
          <Button type="submit" size="sm" loading={saving} disabled={!changed}>
            Save
          </Button>
        </div>
      </form>
    </section>
  )
}

function RidersCard({
  settings,
  onSettings,
  riders,
  onRiders,
}: {
  settings: CallSettings
  onSettings: (s: CallSettings) => void
  riders: Rider[]
  onRiders: (r: Rider[]) => void
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+234 ')
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (name.trim().length < 2) return setFormError('Enter the rider’s name.')
    const e164 = toE164(phone)
    if (!e164) return setFormError('That phone number doesn’t look right. Try 0803 123 4567.')
    setAdding(true)
    try {
      const rider = await api.createRider({ name: name.trim(), phone: e164 })
      onRiders([...riders, rider].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setPhone('+234 ')
      toast.success(`${rider.name} added`)
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setAdding(false)
    }
  }

  const remove = async (rider: Rider) => {
    if (!window.confirm(`Remove ${rider.name}? Orders that name them will have no rider.`)) return
    setRemoving(rider.id)
    try {
      await api.deleteRider(rider.id)
      onRiders(riders.filter((r) => r.id !== rider.id))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setRemoving(null)
    }
  }

  const toggle = async () => {
    setToggling(true)
    try {
      onSettings(await api.saveCallSettings({ rider_calls: !settings.riderCalls }))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setToggling(false)
    }
  }

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-ink/10 sm:p-6">
      <h2 className="font-display text-xl font-bold text-ink">Riders</h2>
      <p className="mt-1 text-[15px] text-ink-soft">
        Pick a rider on an order. When the customer confirms, the rider gets the confirmed address, landmark and time.
      </p>

      <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl bg-paper p-4 ring-1 ring-ink/10">
        <div className="min-w-0">
          <p id="rider-calls-label" className="font-semibold text-ink">
            Call the rider when a customer confirms
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Uses one call from your plan, only if the rider picks up. The rider link is always free to share.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.riderCalls}
          aria-labelledby="rider-calls-label"
          onClick={toggle}
          disabled={toggling}
          className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${
            settings.riderCalls ? 'bg-good' : 'bg-ink/20'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
              settings.riderCalls ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {riders.length > 0 ? (
        <ul className="mt-4 divide-y divide-ink/10 rounded-2xl ring-1 ring-ink/10">
          {riders.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3 pl-3 pr-1.5 sm:pl-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danfo-soft text-ink">
                <BikeIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{r.name}</p>
                <p className="truncate text-sm text-ink-muted">
                  {formatPhone(r.phone)}
                  {r.open_orders ? ` · ${r.open_orders} open order${r.open_orders === 1 ? '' : 's'}` : ''}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="px-2.5" onClick={() => remove(r)} loading={removing === r.id}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-mist px-4 py-3 text-[15px] text-ink-soft">No riders yet. Add the people who deliver for you.</p>
      )}

      <form onSubmit={add} className="mt-5 flex flex-col gap-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rider’s name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tunde Bakare" autoComplete="off" />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+234 809 111 2222" />
          </Field>
        </div>
        {formError && <p className="rounded-xl bg-bad-soft px-4 py-2.5 text-sm font-medium text-bad">{formError}</p>}
        <Button type="submit" variant="secondary" size="sm" loading={adding} icon={<PlusIcon className="h-4 w-4" />} className="self-start">
          Add rider
        </Button>
      </form>
    </section>
  )
}
