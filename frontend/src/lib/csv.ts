/** Small CSV parser that handles quoted fields, commas and newlines inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (nonEmpty.length === 0) return []
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase())
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => (obj[h] = (r[i] ?? '').trim()))
    return obj
  })
}

export const ORDER_CSV_COLUMNS = ['customer_name', 'phone', 'item', 'seller', 'address', 'delivery_window'] as const

export const SAMPLE_ORDER_CSV =
  ORDER_CSV_COLUMNS.join(',') +
  '\n' +
  'Adaeze Okafor,08031234567,Bluetooth speaker,Jumia,"12 Admiralty Way, Lekki Phase 1",Today 2pm-5pm\n' +
  'Tunde Bakare,+2348092223344,Ankara fabric (6 yards),Mama Nkechi Fabrics,"Plot 4 Bode Thomas St, Surulere",Tomorrow 10am-1pm\n'
