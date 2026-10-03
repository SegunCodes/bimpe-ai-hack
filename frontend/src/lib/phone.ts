// Nigerian-first phone helpers. The API always receives E.164 (+2348031234567).

/** Turns whatever the user typed into E.164, or returns null if it doesn't look valid. */
export function toE164(input: string): string | null {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  let e164: string
  if (trimmed.startsWith('+')) e164 = '+' + digits
  else if (digits.startsWith('234')) e164 = '+' + digits
  else if (digits.startsWith('0') && digits.length === 11) e164 = '+234' + digits.slice(1)
  else if (digits.length === 10 && /^[789]/.test(digits)) e164 = '+234' + digits
  else e164 = '+' + digits

  // Nigerian numbers have exactly 10 digits after +234
  if (e164.startsWith('+234') && e164.length !== 14) return null
  if (!/^\+\d{8,15}$/.test(e164)) return null
  return e164
}

/** Pretty display: +234 803 123 4567. Falls back to the raw value. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const e164 = toE164(phone)
  if (!e164) return phone
  const m = e164.match(/^\+234(\d{3})(\d{3})(\d{4})$/)
  if (m) return `+234 ${m[1]} ${m[2]} ${m[3]}`
  return e164
}
