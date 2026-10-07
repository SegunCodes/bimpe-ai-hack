'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatPhone, toE164 } from '../lib/phone'
import {
  CALL_PLANS,
  DEFAULT_PLAN,
  DELIVERY_SLOTS,
  computeCallAt,
  defaultDelivery,
  deliveryWindowText,
  friendlyWhen,
  lagosToDate,
} from '../lib/schedule'
import type { Customer, Rider } from '../lib/types'
import { useToast } from '../components/Toast'
import { PhoneIcon } from '../components/Icons'
import { Button } from '../components/Button'
import { Field, Modal, Segmented, inputClass } from '../components/Overlay'

export function AddOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [customerId, setCustomerId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+234 ')
  const [item, setItem] = useState('')
  const [riders, setRiders] = useState<Rider[] | null>(null)
  const [riderId, setRiderId] = useState('')
  const [address, setAddress] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(() => defaultDelivery().date)
  const [slotId, setSlotId] = useState(() => defaultDelivery().slot)
  const [plan, setPlan] = useState<string>(DEFAULT_PLAN)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listCustomers()
      .then((list) => {
        setCustomers(list)
        if (list.length === 0) setMode('new')
      })
      .catch(() => {
        setCustomers([])
        setMode('new')
      })
    api
      .listRiders()
      .then(setRiders)
      .catch(() => setRiders([]))
  }, [])

  // Pre-fill the address from the customer's profile when picking an existing customer
  const pickCustomer = (id: string) => {
    setCustomerId(id)
    const c = customers?.find((x) => String(x.id) === id)
    if (c?.address && !address) setAddress(c.address)
  }

  const slot = DELIVERY_SLOTS.find((s) => s.id === slotId) ?? DELIVERY_SLOTS[0]
  const deliveryAt = lagosToDate(deliveryDate, slot.start)
  const schedule = deliveryAt ? computeCallAt(deliveryAt, plan) : null
  const customerName = mode === 'new' ? name.trim() : customers?.find((c) => String(c.id) === customerId)?.name

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!item.trim() || !address.trim()) return setFormError('Item and address are required.')
    if (!deliveryAt || !schedule) return setFormError('Pick a delivery date.')
    if (deliveryAt.getTime() < Date.now() - 60 * 60 * 1000) return setFormError('That delivery time is in the past.')

    let cid: number
    if (mode === 'existing') {
      if (!customerId) return setFormError('Pick a customer.')
      cid = Number(customerId)
    } else {
      if (!name.trim()) return setFormError('Enter the customer name.')
      const e164 = toE164(phone)
      if (!e164) return setFormError('That phone number doesn’t look right. Try 0803 123 4567 or +234 803 123 4567.')
      setSaving(true)
      try {
        const existing = customers?.find((c) => toE164(c.phone) === e164)
        cid = existing ? existing.id : (await api.createCustomer({ name: name.trim(), phone: e164, address: address.trim() })).id
      } catch (err) {
        setSaving(false)
        return setFormError(`Couldn't create the customer: ${errorMessage(err)}`)
      }
    }

    setSaving(true)
    try {
      // Recompute at submit time so "right away" really means now
      const { callAt } = computeCallAt(deliveryAt, plan)
      await api.createOrder({
        customer_id: cid,
        item: item.trim(),
        address_on_file: address.trim(),
        delivery_window: deliveryWindowText(deliveryAt, slot.label),
        delivery_at: deliveryAt.toISOString(),
        call_at: callAt.toISOString(),
        call_plan: plan,
        rider_id: riderId ? Number(riderId) : null,
      })
      toast.success(`Order added. Tellero AI will call ${plan === 'now' ? 'right away' : friendlyWhen(callAt)}`)
      onCreated()
      onClose()
    } catch (err) {
      setFormError(`Couldn't add the order: ${errorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add order" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Segmented
          id="customer-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'existing', label: 'Existing customer', disabled: customers?.length === 0 },
            { value: 'new', label: 'New customer' },
          ]}
        />

        {mode === 'existing' ? (
          <Field label="Customer">
            <select className={inputClass} value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
              <option value="">{customers === null ? 'Loading customers…' : 'Choose a customer'}</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {formatPhone(c.phone)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Adaeze Okafor" />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+234 803 123 4567" />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Item">
            <input className={inputClass} value={item} onChange={(e) => setItem(e.target.value)} placeholder="Bluetooth speaker" />
          </Field>
          <Field label="Rider (optional)">
            <select className={inputClass} value={riderId} onChange={(e) => setRiderId(e.target.value)} disabled={riders === null}>
              <option value="">{riders === null ? 'Loading riders…' : riders.length === 0 ? 'No riders yet' : 'Choose later'}</option>
              {riders?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {riders?.length === 0 && (
              <span className="mt-1 block text-sm text-ink-muted">
                Add riders in{' '}
                <Link href="/dashboard/settings" className="font-semibold text-ink underline underline-offset-4">
                  Settings
                </Link>
                .
              </span>
            )}
          </Field>
        </div>
        <Field label="Delivery address">
          <textarea className={inputClass} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Admiralty Way, Lekki Phase 1" />
        </Field>

        <div className="rounded-3xl bg-paper p-4 ring-1 ring-ink/10 sm:p-5">
          <div className="flex flex-col gap-4">
            <Field label="Delivery date">
              <input type="date" className={inputClass} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Delivery time</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DELIVERY_SLOTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSlotId(s.id)}
                    aria-pressed={slotId === s.id}
                    className={`btn h-11 rounded-xl px-2 text-sm font-semibold ${
                      slotId === s.id ? 'btn-primary text-white' : 'btn-secondary bg-white text-ink-soft'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="When should Tellero AI call?">
              <select className={inputClass} value={plan} onChange={(e) => setPlan(e.target.value)}>
                {CALL_PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            {schedule && (
              <p className="rounded-2xl bg-danfo-soft px-4 py-3 text-base text-ink ring-1 ring-danfo/50">
                Tellero AI will call {customerName || 'the customer'}{' '}
                <span className="font-bold">{plan === 'now' || schedule.late ? 'right away' : friendlyWhen(schedule.callAt)}</span>
                {schedule.late && plan !== 'now' && <span className="block text-sm">(that time has already passed)</span>}
                <span className="block text-sm text-ink-soft">If they don't pick up, it tries again twice, 30 minutes apart.</span>
                {riderId && (
                  <span className="block text-sm text-ink-soft">
                    Once they confirm, {riders?.find((r) => String(r.id) === riderId)?.name ?? 'the rider'} gets the details.
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {formError && <p className="rounded-xl bg-bad-soft px-4 py-3 text-base font-medium text-bad">{formError}</p>}

        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} icon={<PhoneIcon className="h-4 w-4" />}>
            Schedule order
          </Button>
        </div>
      </form>
    </Modal>
  )
}
