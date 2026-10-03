'use client'

import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { LANGUAGES } from '../lib/format'
import { toE164 } from '../lib/phone'
import type { Language } from '../lib/types'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { Field, Modal, inputClass } from '../components/Overlay'

export function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+234 ')
  const [language, setLanguage] = useState<Language | ''>('')
  const [address, setAddress] = useState('')
  const [landmark, setLandmark] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) return setFormError('Enter a name.')
    const e164 = toE164(phone)
    if (!e164) return setFormError('That phone number doesn’t look right. Try 0803 123 4567 or +234 803 123 4567.')

    setSaving(true)
    try {
      await api.createCustomer({
        name: name.trim(),
        phone: e164,
        language: language || undefined,
        address: address.trim() || undefined,
        landmark: landmark.trim() || undefined,
      })
      toast.success(`${name.trim()} added`)
      onCreated()
      onClose()
    } catch (err) {
      setFormError(`Couldn't add the customer: ${errorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add customer" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Chinedu Eze" />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+234 803 123 4567" />
          </Field>
        </div>
        <Field label="Language (optional)">
          <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value as Language | '')}>
            <option value="">Let Tellero find out</option>
            {Object.entries(LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Address (optional)">
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="5 Allen Avenue, Ikeja" />
        </Field>
        <Field label="Landmark (optional)">
          <input className={inputClass} value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Opposite the Mobil filling station" />
        </Field>

        {formError && <p className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700">{formError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add customer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
