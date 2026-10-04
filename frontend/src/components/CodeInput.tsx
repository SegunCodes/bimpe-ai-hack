'use client'

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react'

/** Six boxes; the code is checked as soon as the sixth digit lands (typed or pasted). */
export function CodeInput({
  onComplete,
  onChange: onCodeChange,
  busy,
  keepValue = false,
}: {
  onComplete?: (code: string) => void
  /** Called on every change (used when the code is submitted with other fields). */
  onChange?: (code: string) => void
  busy: boolean
  /** Keep the digits after completion instead of clearing them for another try. */
  keepValue?: boolean
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const update = (next: string[]) => {
    setDigits(next)
    onCodeChange?.(next.join(''))
    if (next.every((d) => d !== '')) onComplete?.(next.join(''))
  }
  const onChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    if (!value) return
    const next = [...digits]
    // Typing (or autofill) can deliver several digits at once: spread them forward.
    value.split('').forEach((d, k) => {
      if (i + k < 6) next[i + k] = d
    })
    update(next)
    refs.current[Math.min(5, i + value.length)]?.focus()
  }
  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      if (next[i]) next[i] = ''
      else if (i > 0) {
        next[i - 1] = ''
        refs.current[i - 1]?.focus()
      }
      setDigits(next)
      onCodeChange?.(next.join(''))
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    const next = Array(6).fill('').map((_, k) => pasted[k] ?? '')
    update(next)
    refs.current[Math.min(5, pasted.length)]?.focus()
  }

  // Clear the boxes after a wrong code so they can type again.
  useEffect(() => {
    if (!keepValue && !busy && digits.every((d) => d !== '')) {
      const t = setTimeout(() => {
        setDigits(Array(6).fill(''))
        refs.current[0]?.focus()
      }, 600)
      return () => clearTimeout(t)
    }
  }, [busy]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex gap-2 sm:gap-3" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={d}
          onChange={(e) => onChange(i, e)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          disabled={busy}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1}`}
          className="h-14 w-10 rounded-xl bg-paper text-center font-display text-2xl font-bold text-ink ring-1 ring-inset ring-ink/20 focus:outline-none focus:ring-2 focus:ring-ink disabled:opacity-60 sm:w-12"
        />
      ))}
    </div>
  )
}

