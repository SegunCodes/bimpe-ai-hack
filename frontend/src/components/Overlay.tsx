import { useEffect, type ReactNode } from 'react'

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
    <button onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700">
      ×
    </button>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 animate-fade-in sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl animate-slide-in sm:rounded-3xl sm:p-8 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <CloseButton onClose={onClose} />
        </div>
        {children}
      </div>
    </div>
  )
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30 animate-fade-in" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="relative h-full w-full max-w-3xl overflow-y-auto bg-slate-50 shadow-2xl animate-drawer-in"
      >
        <div className="absolute right-4 top-4 z-10">
          <CloseButton onClose={onClose} />
        </div>
        {children}
      </aside>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border-0 bg-white px-4 py-3 text-base text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-accent-500 focus:outline-none'
