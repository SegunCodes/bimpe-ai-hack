'use client'

import { useState, type ChangeEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { ORDER_CSV_COLUMNS, ORDER_CSV_OPTIONAL, SAMPLE_ORDER_CSV, parseCsv } from '../lib/csv'
import { formatPhone, toE164 } from '../lib/phone'
import {
  CALL_PLANS,
  DEFAULT_PLAN,
  computeCallAt,
  deliveryWindowText,
  friendlyWhen,
  lagosTimeLabel,
  lagosToDate,
  parseDeliveryDate,
  parseTime,
} from '../lib/schedule'
import type { NewOrder } from '../lib/types'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { Modal, inputClass } from '../components/Overlay'

interface Row {
  customer_name: string
  phone: string
  item: string
  seller: string
  address: string
  deliveryAt: Date | null
  windowLabel: string
  problem?: string
}

const DEFAULT_TIME = '09:00'

function readRow(raw: Record<string, string>): Row {
  const date = parseDeliveryDate(raw.delivery_date ?? '')
  const time = raw.delivery_time ? parseTime(raw.delivery_time) : DEFAULT_TIME
  const deliveryAt = date && time ? lagosToDate(date, time) : null
  const row: Row = {
    customer_name: raw.customer_name ?? '',
    phone: toE164(raw.phone ?? '') ?? raw.phone ?? '',
    item: raw.item ?? '',
    seller: raw.seller ?? '',
    address: raw.address ?? '',
    deliveryAt,
    windowLabel: raw.delivery_window || (deliveryAt ? `from ${lagosTimeLabel(deliveryAt)}` : ''),
  }
  if (!row.customer_name) row.problem = 'Missing customer_name'
  else if (!toE164(raw.phone ?? '')) row.problem = 'Invalid phone'
  else if (!row.item) row.problem = 'Missing item'
  else if (!row.address) row.problem = 'Missing address'
  else if (!date) row.problem = 'Bad delivery_date (use 2026-10-04 or 04/10/2026)'
  else if (!time) row.problem = 'Bad delivery_time (use 14:00 or 2pm)'
  return row
}

export function ImportCsvModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const toast = useToast()
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [plan, setPlan] = useState<string>(DEFAULT_PLAN)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    try {
      const parsed = parseCsv(await file.text())
      if (parsed.length === 0) {
        setRows(null)
        return setParseError('The file has no data rows.')
      }
      const missing = ORDER_CSV_COLUMNS.filter((c) => !(c in parsed[0]))
      if (missing.length) {
        setRows(null)
        return setParseError(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`)
      }
      setRows(parsed.map(readRow))
    } catch {
      setParseError("Couldn't read that file. Make sure it's a .csv.")
    }
  }

  const valid = rows?.filter((r) => !r.problem) ?? []
  const invalid = rows?.filter((r) => r.problem) ?? []

  const doImport = async () => {
    setImporting(true)
    try {
      // Re-use existing customers (matched by phone), create the rest
      setProgress('Checking customers…')
      const existing = await api.listCustomers()
      const idByPhone = new Map<string, number>()
      existing.forEach((c) => {
        const p = toE164(c.phone)
        if (p) idByPhone.set(p, c.id)
      })

      let created = 0
      for (const r of valid) {
        if (idByPhone.has(r.phone)) continue
        setProgress(`Creating customer ${r.customer_name}…`)
        const c = await api.createCustomer({ name: r.customer_name, phone: r.phone, address: r.address })
        idByPhone.set(r.phone, c.id)
        created++
      }

      setProgress('Scheduling orders…')
      const orders: NewOrder[] = valid.map((r) => ({
        customer_id: idByPhone.get(r.phone)!,
        item: r.item,
        seller: r.seller,
        address_on_file: r.address,
        delivery_window: deliveryWindowText(r.deliveryAt!, r.windowLabel),
        delivery_at: r.deliveryAt!.toISOString(),
        call_at: computeCallAt(r.deliveryAt!, plan).callAt.toISOString(),
        call_plan: plan,
      }))
      const result = await api.bulkCreateOrders(orders)
      toast.success(`Scheduled ${result?.length ?? orders.length} orders${created ? ` and added ${created} new customers` : ''}`)
      onImported()
      onClose()
    } catch (err) {
      toast.error(`Import failed: ${errorMessage(err)}`)
    } finally {
      setImporting(false)
      setProgress('')
    }
  }

  const sampleHref = 'data:text/csv;charset=utf-8,' + encodeURIComponent(SAMPLE_ORDER_CSV)

  return (
    <Modal title="Import orders from CSV" onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <p className="text-base text-ink-soft">
          Columns needed: <code className="rounded bg-mist px-1.5 py-0.5 text-sm">{ORDER_CSV_COLUMNS.join(', ')}</code>. Optional:{' '}
          <code className="rounded bg-mist px-1.5 py-0.5 text-sm">{ORDER_CSV_OPTIONAL.join(', ')}</code> (time defaults to 9am, Lagos time).{' '}
          <a href={sampleHref} download="sample-orders.csv" className="font-semibold text-ink underline decoration-danfo decoration-2 underline-offset-4">
            Download a sample
          </a>
        </p>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-ink/15 bg-paper px-6 py-10 text-center hover:border-ink/40 hover:bg-accent-50">
          <span className="text-lg font-semibold">{fileName || 'Choose a CSV file'}</span>
          <span className="text-sm text-ink-muted">Click to browse</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
        </label>

        {parseError && <p className="rounded-xl bg-bad-soft px-4 py-3 text-base font-medium text-bad">{parseError}</p>}

        {rows && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">When should Tellero call? (applies to every order in this file)</span>
              <select className={inputClass} value={plan} onChange={(e) => setPlan(e.target.value)}>
                {CALL_PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3 text-base">
              <span className="rounded-full bg-good-soft px-3 py-1 font-semibold text-good">{valid.length} ready</span>
              {invalid.length > 0 && <span className="rounded-full bg-bad-soft px-3 py-1 font-semibold text-bad">{invalid.length} will be skipped</span>}
            </div>
            <div className="max-h-72 overflow-auto rounded-2xl ring-1 ring-ink/10">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-paper text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Delivery</th>
                    <th className="px-3 py-2">Tellero calls</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-t border-line ${r.problem ? 'bg-bad-soft/60' : ''}`}>
                      <td className="px-3 py-2 font-medium">{r.customer_name || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatPhone(r.phone)}</td>
                      <td className="px-3 py-2">{r.item}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.deliveryAt ? friendlyWhen(r.deliveryAt) : '—'}</td>
                      <td className="px-3 py-2">
                        {r.problem ? (
                          <span className="font-semibold text-bad">{r.problem}</span>
                        ) : (
                          <span className="whitespace-nowrap">{friendlyWhen(computeCallAt(r.deliveryAt!, plan).callAt)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 [&>button]:flex-1 sm:[&>button]:flex-none">
          {progress && <span className="mr-auto text-sm text-ink-muted">{progress}</span>}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={doImport} loading={importing} disabled={valid.length === 0}>
            Schedule {valid.length > 0 ? `${valid.length} orders` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
