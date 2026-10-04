/**
 * The dashboard session token, kept in this browser only. Storage can be unavailable
 * (private mode, blocked site data), so every access is guarded.
 */
const KEY = 'tellero-admin-session'
export const SIGNED_OUT_EVENT = 'tellero:signed-out'

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(KEY, token)
  } catch {
    // Signed in for this tab only; a refresh will ask again.
  }
  memoryToken = token
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // nothing stored
  }
  memoryToken = null
  window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
}

let memoryToken: string | null = null

/** Token to send with requests: storage first, then this tab's memory. */
export function currentToken(): string | null {
  if (typeof window === 'undefined') return null
  return getToken() ?? memoryToken
}
