import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { formatPhone, toE164 } from '../lib/phone'
import type { Customer } from '../lib/types'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { Field, Modal, inputClass } from '../components/Overlay'

export function AddOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [customerId, setCustomerId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+234 ')
  const [item, setItem] = useState('')
  const [seller, setSeller] = useState('')
  const [address, setAddress] = useState('')
  const [deliveryWindow, setDeliveryWindow] = useState('')
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
  }, [])

  // Pre-fill the address from the customer's profile when picking an existing customer
  const pickCustomer = (id: string) => {
    setCustomerId(id)
    const c = customers?.find((x) => String(x.id) === id)
    if (c?.address && !address) setAddress(c.address)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!item.trim() || !seller.trim() || !address.trim()) return setFormError('Item, seller and address are required.')

    let cid: number
    if (mode === 'existing') {
      if (!customerId) return setFormError('Pick a customer.')
      cid = Number(customerId)
    } else {
      if (!name.trim()) return setFormError('Enter the customer name.')
      const e164 = toE164(phone)
      if (!e164) return setFormError('That phone number doesn’t look right. Try 0803 123 4567 or +234 803 123 4567.')
      cid = -1
      setSaving(true)
      try {
        const existing = customers?.find((c) => toE164(c.phone) === e164)
        cid = existing ? existing.id : (await api.createCustomer({ name: name.trim(), phone: e164, address: address.trim() || undefined })).id
      } catch (err) {
        setSaving(false)
        return setFormError(`Couldn't create the customer: ${errorMessage(err)}`)
      }
    }

    setSaving(true)
    try {
      await api.createOrder({
        customer_id: cid,
        item: item.trim(),
        seller: seller.trim(),
        address_on_file: address.trim(),
        delivery_window: deliveryWindow.trim(),
      })
      toast.success('Order added')
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
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          {(['existing', 'new'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={m === 'existing' && customers?.length === 0}
              className={`rounded-xl py-2.5 text-base font-semibold disabled:text-slate-400 ${mode === m ? 'bg-white shadow-sm' : 'text-slate-600'}`}
            >
              {m === 'existing' ? 'Existing customer' : 'New customer'}
            </button>
          ))}
        </div>

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
          <Field label="Seller">
            <input className={inputClass} value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="Jumia" />
          </Field>
        </div>
        <Field label="Delivery address">
          <textarea className={inputClass} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Admiralty Way, Lekki Phase 1" />
        </Field>
        <Field label="Delivery window" hint="Free text, e.g. “Today 2pm–5pm”">
          <input className={inputClass} value={deliveryWindow} onChange={(e) => setDeliveryWindow(e.target.value)} placeholder="Today 2pm–5pm" />
        </Field>

        {formError && <p className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700">{formError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add order
          </Button>
        </div>
      </form>
    </Modal>
  )
}
