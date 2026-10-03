'use client'

import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let nextId = 1

const STYLES: Record<ToastKind, { bg: string; icon: string }> = {
  success: { bg: 'bg-emerald-600', icon: '✓' },
  error: { bg: 'bg-red-600', icon: '!' },
  info: { bg: 'bg-slate-800', icon: 'i' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++
      setToasts((t) => [...t.slice(-3), { id, kind, message }])
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500)
    },
    [dismiss],
  )

  const [toastApi] = useState<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }))

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              role="status"
              // Enter from below, leave the same way. Gentle `ease`, a touch slower than other UI (Sonner-style).
              initial={{ opacity: 0, transform: 'translateY(100%)' }}
              animate={{ opacity: 1, transform: 'translateY(0%)' }}
              exit={{ opacity: 0, transform: 'translateY(100%)' }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={() => dismiss(t.id)}
              className={`${STYLES[t.kind].bg} pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-2xl px-5 py-4 text-base font-semibold text-white shadow-xl`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">{STYLES[t.kind].icon}</span>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
