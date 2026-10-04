'use client'

import { motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

// Shared curves (same values as the CSS tokens in globals.css)
export const EASE_OUT = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close"
      className="btn btn-ghost flex h-10 w-10 items-center justify-center rounded-xl text-2xl leading-none text-ink-faint hover:text-ink-soft"
    >
      ×
    </button>
  )
}

function Backdrop({ onClose, className }: { onClose: () => void; className: string }) {
  return (
    <motion.div
      className={`fixed inset-0 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      onMouseDown={onClose}
    />
  )
}

/**
 * Centered dialog. Render it inside <AnimatePresence> so it can animate out.
 * Not anchored to a trigger, so it scales from its own center.
 */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <Backdrop onClose={onClose} className="bg-ink/50 backdrop-blur-[2px]" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, transform: 'scale(0.96)' }}
        animate={{ opacity: 1, transform: 'scale(1)' }}
        exit={{ opacity: 0, transform: 'scale(0.96)' }}
        transition={{ duration: 0.25, ease: EASE_OUT }}
        className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-8 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4 sm:mb-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl tracking-[-0.02em] text-ink">{title}</h2>
          <CloseButton onClose={onClose} />
        </div>
        {children}
      </motion.div>
    </div>
  )
}

/** Side panel that slides in from the right and leaves the same way. Render inside <AnimatePresence>. */
export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Backdrop onClose={onClose} className="bg-ink/40" />
      <motion.aside
        role="dialog"
        aria-modal="true"
        initial={{ transform: 'translateX(100%)' }}
        animate={{ transform: 'translateX(0%)', transition: { duration: 0.45, ease: EASE_DRAWER } }}
        exit={{ transform: 'translateX(100%)', transition: { duration: 0.3, ease: EASE_DRAWER } }}
        className="relative h-full w-full max-w-3xl overflow-y-auto bg-paper shadow-2xl"
      >
        <div className="absolute right-4 top-4 z-10">
          <CloseButton onClose={onClose} />
        </div>
        {children}
      </motion.aside>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-ink-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border-0 bg-white px-4 py-3 text-base text-ink ring-1 ring-inset ring-ink/20 placeholder:text-ink-faint transition-shadow duration-200 focus:ring-2 focus:ring-ink focus:outline-none'

/** Pill toggle whose highlight slides between options (spatial consistency). */
export function Segmented<T extends string>({
  id,
  options,
  value,
  onChange,
  className = '',
}: {
  id: string
  options: { value: T; label: string; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`grid gap-1 rounded-2xl bg-mist p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`btn relative rounded-xl px-2 py-2.5 text-sm font-semibold disabled:text-ink-faint sm:text-base ${value === o.value ? 'text-ink' : 'text-ink-soft'}`}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-ink/10"
              transition={{ duration: 0.25, ease: EASE_IN_OUT }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
