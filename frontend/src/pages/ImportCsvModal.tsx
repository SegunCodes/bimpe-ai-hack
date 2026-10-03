import { useState, type ChangeEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { ORDER_CSV_COLUMNS, SAMPLE_ORDER_CSV, parseCsv } from '../lib/csv'
import { formatPhone, toE164 } from '../lib/phone'
import type { NewOrder } from '../lib/types'
import { useToast } from '../components/Toast'
import { Button } from '../components/Button'
import { Modal } from '../components/Overlay'

interface Row {
  customer_name: string
  phone: string
  item: string
  seller: string
  address: string
  delivery_window: string
  problem?: string
}

function validate(raw: Record<string, string>): Row {
  const row: Row = {
    customer_name: raw.customer_name ?? '',
    phone: toE164(raw.phone ?? '') ?? raw.phone ?? '',
    item: raw.item ?? '',
    seller: raw.seller ?? '',
    address: raw.address ?? '',
    delivery_window: raw.delivery_window ?? '',
  }
  if (!row.customer_name) row.problem = 'Missing customer_name'
  else if (!toE164(raw.phone ?? '')) row.problem = 'Invalid phone'
  else if (!row.item) row.problem = 'Missing item'
  else if (!row.address) row.problem = 'Missing address'
  return row
}

export function ImportCsvModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const toast = useToast()
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
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
      setRows(parsed.map(validate))
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

      setProgress('Creating orders…')
      const orders: NewOrder[] = valid.map((r) => ({
        customer_id: idByPhone.get(r.phone)!,
        item: r.item,
        seller: r.seller,
        address_on_file: r.address,
        delivery_window: r.delivery_window,
      }))
      const result = await api.bulkCreateOrders(orders)
      toast.success(`Imported ${result?.length ?? orders.length} orders${created ? ` and ${created} new customers` : ''}`)
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
        <p className="text-base text-slate-600">
          Columns needed: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">{ORDER_CSV_COLUMNS.join(', ')}</code>.{' '}
          <a href={sampleHref} download="sample-orders.csv" className="font-semibold text-accent-600 underline">
            Download a sample
          </a>
        </p>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-accent-500 hover:bg-accent-50">
          <span className="text-lg font-semibold">{fileName || 'Choose a CSV file'}</span>
          <span className="text-sm text-slate-500">Click to browse</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
        </label>

        {parseError && <p className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700">{parseError}</p>}

        {rows && (
          <>
            <div className="flex flex-wrap gap-3 text-base">
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">{valid.length} ready</span>
              {invalid.length > 0 && <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-800">{invalid.length} will be skipped</span>}
            </div>
            <div className="max-h-72 overflow-auto rounded-2xl ring-1 ring-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Address</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-t border-slate-100 ${r.problem ? 'bg-red-50/60' : ''}`}>
                      <td className="px-3 py-2 font-medium">{r.customer_name || '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{formatPhone(r.phone)}</td>
                      <td className="px-3 py-2">{r.item}</td>
                      <td className="max-w-[200px] truncate px-3 py-2">{r.address}</td>
                      <td className="px-3 py-2 font-semibold text-red-700">{r.problem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-3">
          {progress && <span className="mr-auto text-sm text-slate-500">{progress}</span>}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={doImport} loading={importing} disabled={valid.length === 0}>
            Import {valid.length > 0 ? `${valid.length} orders` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
