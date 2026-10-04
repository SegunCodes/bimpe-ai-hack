/**
 * Sign-in tokens, kept in this browser only: one for a business (the dashboard) and one for
 * the platform owner (/admin). Storage can be unavailable (private mode, blocked site data),
 * so every access is guarded and falls back to this tab's memory.
 */
export type SessionKind = 'business' | 'admin'

const KEYS: Record<SessionKind, string> = { business: 'tellero-business-session', admin: 'tellero-admin-session' }
export const SIGNED_OUT_EVENT = 'tellero:signed-out'

const memory: Record<SessionKind, string | null> = { business: null, admin: null }

export function getToken(kind: SessionKind): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KEYS[kind]) ?? memory[kind]
  } catch {
    return memory[kind]
  }
}

export function setToken(kind: SessionKind, token: string): void {
  memory[kind] = token
  try {
    window.localStorage.setItem(KEYS[kind], token)
  } catch {
    // Signed in for this tab only; a refresh will ask again.
  }
}

export function clearToken(kind: SessionKind): void {
  memory[kind] = null
  try {
    window.localStorage.removeItem(KEYS[kind])
  } catch {
    // nothing stored
  }
  window.dispatchEvent(new CustomEvent(SIGNED_OUT_EVENT, { detail: kind }))
}
